import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Node, SyntaxKind } from "ts-morph";
import type { AuditFile, AuditFinding, AuditRule, AuditRuleContext } from "../rule.js";
import { callTarget, finding, sourceLineNumber } from "./helpers.js";

export const astroRules: AuditRule[] = [
  {
    id: "NB-ASTRO-001",
    code: "server-only-hydrated-island",
    architecture: "islands-architecture",
    defaultSeverity: "err",
    stacks: ["astro"],
    kind: "project",
    check: hydratedIslandFindings,
  },
  {
    id: "NB-ASTRO-002",
    code: "astro-db-removed",
    architecture: "content-modeling",
    defaultSeverity: "warn",
    stacks: ["astro"],
    kind: "project",
    check(context) {
      return (context.stack.astro?.major ?? 0) >= 7 && isDeclared(context, "@astrojs/db")
        ? [projectFinding("NB-ASTRO-002", "astro-db-removed", "@astrojs/db")]
        : [];
    },
  },
  {
    id: "NB-ASTRO-003",
    code: "legacy-tailwind-integration",
    architecture: "styling-tailwind",
    defaultSeverity: "warn",
    stacks: ["astro"],
    kind: "project",
    check(context) {
      return (context.stack.packages.tailwindcss?.major ?? 0) >= 4 && isDeclared(context, "@astrojs/tailwind")
        ? [projectFinding("NB-ASTRO-003", "legacy-tailwind-integration", "@astrojs/tailwind")]
        : [];
    },
  },
  {
    id: "NB-ASTRO-004",
    code: "missing-astro-check",
    architecture: "testing-strategy",
    defaultSeverity: "warn",
    stacks: ["astro"],
    kind: "project",
    check(context) {
      const scripts = readPackageScripts(context.rootDir);
      return scripts !== null && !Object.values(scripts).some((command) => command.includes("astro check"))
        ? [projectFinding("NB-ASTRO-004", "missing-astro-check")]
        : [];
    },
  },
  {
    id: "NB-ASTRO-005",
    code: "request-dependent-route-cache",
    architecture: "request-boundaries",
    defaultSeverity: "err",
    stacks: ["astro"],
    kind: "ast",
    check(context) {
      return context.files.flatMap(requestDependentCacheFindings);
    },
  },
];

function hydratedIslandFindings(context: AuditRuleContext): AuditFinding[] {
  const filesByPath = new Map(context.files.map((file) => [file.path, file]));

  return context.files.flatMap((file) => {
    if (!file.astro || !file.sourceFile) {
      return [];
    }

    return file.astro.islands.filter((island) => island.kind === "client").flatMap((island) => {
      const declaration = file.sourceFile?.getImportDeclarations().find((candidate) => {
        if (candidate.getDefaultImport()?.getText() === island.component) {
          return true;
        }
        return candidate.getNamedImports().some((namedImport) =>
          (namedImport.getAliasNode()?.getText() ?? namedImport.getName()) === island.component,
        );
      });
      if (!declaration) {
        return [];
      }

      const line = sourceLineNumber(file, declaration.getStartLineNumber());
      const targetPath = context.moduleResolver.resolve(file, declaration.getModuleSpecifierValue(), line);
      const target = targetPath ? filesByPath.get(targetPath) : undefined;
      const serverImport = target?.sourceFile?.getImportDeclarations().find((candidate) => {
        const moduleName = candidate.getModuleSpecifierValue();
        return moduleName.startsWith("node:") || moduleName === "astro:env/server";
      });
      if (!targetPath || !serverImport) {
        return [];
      }

      return [finding(
        file,
        "NB-ASTRO-001",
        "server-only-hydrated-island",
        island.line ?? line,
        `${targetPath}:${serverImport.getModuleSpecifierValue()}`,
      )];
    });
  });
}

function requestDependentCacheFindings(file: AuditFile): AuditFinding[] {
  if (!file.sourceFile || !file.path.startsWith("src/pages/")) {
    return [];
  }

  const cacheDeclaration = file.sourceFile.getVariableDeclarations().find((declaration) =>
    declaration.getName() === "cache" && declaration.getVariableStatement()?.isExported(),
  );
  if (!cacheDeclaration || !usesRequestIdentity(file)) {
    return [];
  }

  return [finding(
    file,
    "NB-ASTRO-005",
    "request-dependent-route-cache",
    sourceLineNumber(file, cacheDeclaration.getStartLineNumber()),
  )];
}

function usesRequestIdentity(file: AuditFile): boolean {
  const sourceFile = file.sourceFile;
  if (!sourceFile) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) => {
    const target = callTarget(access);
    return target === "Astro.session"
      || target === "Astro.cookies"
      || target === "context.session"
      || target === "context.cookies"
      || target?.startsWith("Astro.session.") === true
      || target?.startsWith("Astro.cookies.") === true
      || target?.startsWith("context.session.") === true
      || target?.startsWith("context.cookies.") === true;
  }) || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    callTarget(call.getExpression()) === "Astro.request.headers.get"
      && call.getArguments().some((argument) => Node.isStringLiteral(argument) && argument.getLiteralValue().toLowerCase() === "cookie"),
  );
}

function isDeclared(context: AuditRuleContext, packageName: string): boolean {
  return context.stack.packages[packageName]?.declaredRange !== null
    && context.stack.packages[packageName]?.declaredRange !== undefined;
}

function readPackageScripts(rootDir: string): Record<string, string> | null {
  try {
    const packagePath = join(rootDir, "package.json");
    if (!existsSync(packagePath)) {
      return null;
    }
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: unknown };
    if (typeof parsed.scripts !== "object" || parsed.scripts === null) {
      return {};
    }
    return Object.fromEntries(Object.entries(parsed.scripts)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return null;
  }
}

function projectFinding(rule: string, code: string, ref?: string): AuditFinding {
  return {
    rule,
    sev: "warn",
    file: "package.json",
    line: 1,
    code,
    ref,
  };
}
