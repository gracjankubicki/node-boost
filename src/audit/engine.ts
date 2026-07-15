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

export interface RunAuditOptions {
  rootDir?: string;
  mode?: "all" | "changed" | "base" | "paths";
  base?: string;
  paths?: string[];
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

    if (severity === "off" || !enabledArchitectures.has(rule.architecture) || !rule.stacks.includes(stack.name)) {
      continue;
    }

    const rawFindings = rule.check({
      rootDir,
      stack,
      config,
      files,
      allPaths: new Set(scope.allPaths),
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

  const err = findings.filter((finding) => finding.sev === "err").length;
  const warn = findings.filter((finding) => finding.sev === "warn").length;

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
    findings: findings.sort(compareFindings),
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

      const started = performance.now();
      const sourceFile = project.createSourceFile(absolutePath, content, { overwrite: true });
      const diagnostics = parseDiagnostics(sourceFile.compilerNode).filter((diagnostic) =>
        diagnostic.category === DiagnosticCategory.Error && diagnostic.code < 2000,
      );
      const elapsed = performance.now() - started;
      const skipped = diagnostics.length > 0 || elapsed > 5000;

      if (diagnostics.length > 0) {
        parseWarnings.push({
          rule: "NB-META-002",
          sev: "warn",
          file,
          line: diagnostics[0]?.start === undefined ? 1 : sourceFile.getLineAndColumnAtPos(diagnostics[0].start).line,
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
        skipped,
      };
    }),
  );

  return resolved.filter((file): file is AuditFile => file !== null);
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
