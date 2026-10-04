import { profileSupportsStack } from "../config/profiles.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DiagnosticCategory, Project } from "ts-morph";
import { normalizeArchitectures, parseNodeBoostConfig, type NodeBoostConfig } from "../config/schema.js";
import { detectStack } from "../detect/stack.js";
import { auditRules } from "./registry.js";
import { resolveAuditScope } from "./scope.js";
import { buildSuppressionIndex } from "./suppression.js";
import { createTypeScriptModuleResolver } from "./typescript-resolver.js";
import type { AuditFile, AuditFinding, AuditResult } from "./rule.js";
import { splitTextLines } from "./rules/helpers.js";
import { parseAstroSource, type AstroSourceDocument } from "../astro/source.js";

const maxAuditFileBytes = 2 * 1024 * 1024;

export interface RunAuditOptions {
  rootDir?: string;
  mode?: "all" | "changed" | "base" | "paths";
  base?: string;
  paths?: string[];
  feedbackOnly?: boolean;
}

export class NodeBoostConfigMissingError extends Error {
  constructor() {
    super("No node-boost.json found — run node-boost install first.");
    this.name = "NodeBoostConfigMissingError";
  }
}

export function isNodeBoostConfigMissingError(error: unknown): error is NodeBoostConfigMissingError {
  return error instanceof NodeBoostConfigMissingError;
}

export async function runAudit(options: RunAuditOptions = {}): Promise<AuditResult> {
  const started = performance.now();
  const rootDir = options.rootDir ?? process.cwd();
  const config = await readConfig(rootDir);
  const stack = await detectStack(rootDir);
  if (config.profile && !profileSupportsStack(config.profile, stack.name)) throw new Error(`Profile ${config.profile} does not support detected stack ${stack.name}.`);
  const scope = await resolveAuditScope({
    rootDir,
    config,
    mode: options.mode ?? "all",
    base: options.base,
    paths: options.paths,
  });
  const parseWarnings: AuditFinding[] = [];
  const files = await readAuditFiles(rootDir, scope.files, parseWarnings);
  const suppressionIndex = buildSuppressionIndex(files);
  const enabledArchitectures = new Map(normalizeArchitectures(config).map((architecture) => [architecture.name, architecture.options]));
  const findings: AuditFinding[] = [...scope.warnings, ...parseWarnings, ...suppressionIndex.metaFindings];
  const moduleResolver = createTypeScriptModuleResolver(rootDir);
  let suppressed = 0;

  for (const rule of auditRules) {
    const severity = config.audit.rules[rule.id] ?? rule.defaultSeverity;

    if (severity === "off" || !(rule.id.startsWith("NB-PROFILE-") ? config.profile : enabledArchitectures.has(rule.architecture)) || !rule.stacks.includes(stack.name)) {
      continue;
    }

    const rawFindings = rule.check({
      rootDir,
      stack,
      config,
      files,
      allPaths: new Set(scope.allPaths),
      testPaths: new Set(scope.testPaths ?? []),
      rule,
      severity,
      architectureOptions: enabledArchitectures.get(rule.architecture) ?? {},
      ruleOptions: config.audit.ruleOptions[rule.id] ?? {},
      moduleResolver,
    });

    for (const finding of rawFindings) {
      const normalized = { ...finding, sev: severity };

      if (suppressionIndex.suppresses(normalized.file, normalized.line, normalized.rule)) {
        suppressed += 1;
      } else {
        findings.push(normalized);
      }
    }
  }

  findings.push(...moduleResolver.warnings());

  const reportedFindings = options.feedbackOnly ? findings.filter((finding) => scope.files.includes(finding.file)) : findings;
  const err = reportedFindings.filter((finding) => finding.sev === "err").length;
  const warn = reportedFindings.filter((finding) => finding.sev === "warn").length;

  return {
    v: 1,
    ok: err === 0,
    cmd: "audit",
    scope: scope.mode,
    err,
    warn,
    scanned: files.filter((file) => !file.skipped).length,
    skipped: files.filter((file) => file.skipped).length,
    suppressed,
    elapsedMs: Math.round(performance.now() - started),
    findings: reportedFindings.sort(compareFindings),
  };
}

async function readConfig(rootDir: string): Promise<NodeBoostConfig> {
  const configPath = join(rootDir, "node-boost.json");
  const raw = await readFile(configPath, "utf8").catch((error: unknown) => {
    if (isFileNotFoundError(error)) {
      throw new NodeBoostConfigMissingError();
    }

    throw error;
  });

  return parseNodeBoostConfig(JSON.parse(raw));
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function readAuditFiles(rootDir: string, files: string[], parseWarnings: AuditFinding[]): Promise<AuditFile[]> {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      jsx: 4,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  const resolved = await Promise.all(
    files.map(async (file) => {
      const absolutePath = join(rootDir, file);
      const content = await readFile(absolutePath, "utf8").catch((error: unknown) => {
        if (isFileNotFoundError(error)) {
          parseWarnings.push({
            rule: "NB-META-005",
            sev: "warn",
            file,
            line: 1,
            code: "file-disappeared",
          });
          return null;
        }

        throw error;
      });
      if (content === null) {
        return null;
      }

      if (Buffer.byteLength(content, "utf8") > maxAuditFileBytes) {
        parseWarnings.push({
          rule: "NB-META-003",
          sev: "warn",
          file,
          line: 1,
          code: "file-too-large",
        });
        return {
          path: file,
          absolutePath,
          content,
          lines: [],
          sourceFile: null,
          astro: null,
          skipped: true,
        };
      }

      const started = performance.now();
      const isAstroFile = file.endsWith(".astro");
      const astro = isAstroFile ? await parseAstroDocument(file, content, parseWarnings) : null;
      const sourceContent = astro?.frontmatter ?? (isAstroFile ? "" : content);
      const sourceFile = project.createSourceFile(
        file.endsWith(".astro") ? `${absolutePath}.frontmatter.ts` : absolutePath,
        sourceContent,
        { overwrite: true },
      );
      const diagnostics = parseDiagnostics(sourceFile.compilerNode).filter((diagnostic) =>
        diagnostic.category === DiagnosticCategory.Error && diagnostic.code < 2000,
      );
      const elapsed = performance.now() - started;
      const astroHasErrors = astro?.diagnostics.some(isAstroError) ?? false;
      const skipped = diagnostics.length > 0 || astroHasErrors || (isAstroFile && astro === null) || elapsed > 5000;

      if (diagnostics.length > 0 || astroHasErrors) {
        const astroLine = astro?.diagnostics.find(isAstroError)?.location.line;
        parseWarnings.push({
          rule: "NB-META-002",
          sev: "warn",
          file,
          line: astroLine ?? (diagnostics[0]?.start === undefined ? 1 : sourceFile.getLineAndColumnAtPos(diagnostics[0].start).line),
          code: "parse-error",
        });
      } else if (elapsed > 5000) {
        parseWarnings.push({
          rule: "NB-META-003",
          sev: "warn",
          file,
          line: 1,
          code: "parse-timeout",
        });
      }

      return {
        path: file,
        absolutePath,
        content,
        lines: splitTextLines(content),
        sourceFile: skipped ? null : sourceFile,
        astro: skipped ? null : astro,
        skipped,
      };
    }),
  );

  return resolved.filter((file): file is AuditFile => file !== null);
}

function isAstroError(diagnostic: AstroSourceDocument["diagnostics"][number]): boolean {
  return Number(diagnostic.severity) === 1;
}

async function parseAstroDocument(
  file: string,
  content: string,
  parseWarnings: AuditFinding[],
): Promise<AstroSourceDocument | null> {
  try {
    return await parseAstroSource(content);
  } catch {
    parseWarnings.push({
      rule: "NB-META-002",
      sev: "warn",
      file,
      line: 1,
      code: "parse-error",
    });
    return null;
  }
}

interface ParseDiagnostic {
  category: DiagnosticCategory;
  code: number;
  start?: number;
}

function parseDiagnostics(sourceFile: unknown): readonly ParseDiagnostic[] {
  if (typeof sourceFile !== "object" || sourceFile === null || !("parseDiagnostics" in sourceFile)) {
    return [];
  }

  const diagnostics = sourceFile.parseDiagnostics;
  return Array.isArray(diagnostics) ? diagnostics as ParseDiagnostic[] : [];
}

function compareFindings(a: AuditFinding, b: AuditFinding): number {
  return a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule);
}
