import { Node } from "ts-morph";
import type { AuditFinding, AuditRule, AuditRuleContext } from "../rule.js";

export const profileRules: AuditRule[] = [{
  id: "NB-PROFILE-001", code: "profile-contract-violation", architecture: "rendering-strategy",
  defaultSeverity: "err", stacks: ["next", "vite-react", "astro"], kind: "project",
  check: profileFindings,
}, {
  id: "NB-PROFILE-002", code: "profile-detection-unknown", architecture: "rendering-strategy",
  defaultSeverity: "warn", stacks: ["next", "vite-react", "astro"], kind: "project",
  check(context) {
    const unknown = context.stack.rendering?.unknown || context.stack.warnings.some((warning) => warning.includes("config is dynamic"));
    if (!context.config.profile) return [];
    const findings: AuditFinding[] = unknown ? [{ rule: "NB-PROFILE-002", sev: "warn", file: context.stack.rendering?.source ?? "package.json", line: 1, code: "profile-detection-unknown" }] : [];
    if (context.config.profile === "static-content-site") {
      for (const file of context.files) {
        const names = context.stack.name === "astro" ? ["prerender"] : ["dynamic", "revalidate"];
        for (const name of names) {
          const declaration = file.sourceFile?.getVariableDeclaration(name);
          const value = declaration?.getInitializer();
          if (declaration?.isExported() && value && !Node.isStringLiteral(value) && !Node.isNumericLiteral(value) && !Node.isTrueLiteral(value) && !Node.isFalseLiteral(value)) {
            findings.push({ rule: "NB-PROFILE-002", sev: "warn", file: file.path, line: declaration.getStartLineNumber(), code: "profile-detection-unknown", ref: name });
          }
        }
      }
    }
    return findings;
  },
}];

function profileFindings(context: AuditRuleContext): AuditFinding[] {
  const profile = context.config.profile;
  if (!profile || profile === "server-app") return [];
  const findings: AuditFinding[] = [];
  const add = (file: string, ref: string, line = 1): void => {
    findings.push({ rule: "NB-PROFILE-001", sev: "err", file, line, code: "profile-contract-violation", ref });
  };
  if (profile === "spa") {
    if (context.stack.rendering?.ssr) add(context.stack.rendering.source ?? "vite.config.ts", "SSR build");
  } else if (context.stack.name === "astro") {
    const astro = context.stack.astro;
    if (astro?.adapter) add("package.json", `server adapter: ${astro.adapter}`);
    if (astro?.output === "server") add("package.json", "server output");
    if (astro?.actions) add("src/actions/index.ts", "Astro Actions");
    if (astro?.serverIslands) add("package.json", "server islands");
  } else if (context.stack.name === "next" && !context.stack.rendering?.unknown && context.stack.rendering?.output !== "export") {
    add(context.stack.rendering?.source ?? "package.json", "Next.js requires output: 'export'");
  }
  for (const file of context.files) {
    if (!file.sourceFile || file.path.endsWith(".d.ts")) continue;
    const source = file.sourceFile;
    const parts = file.path.split("/");
    const filename = parts.at(-1) ?? "";
    const basename = filename.slice(0, filename.lastIndexOf("."));
    if (context.stack.name === "astro") {
      const prerender = source.getVariableDeclaration("prerender");
      if (prerender?.isExported() && prerender.getInitializer()?.getText() === "false") add(file.path, "request-time route", prerender.getStartLineNumber());
    } else if (context.stack.name === "next") {
      if (parts.some((part, index) => part === "pages" && parts[index + 1] === "api") || basename === "middleware" || basename === "proxy") add(file.path, "request handler");
      const dynamic = source.getVariableDeclaration("dynamic");
      if (dynamic?.isExported() && dynamic.getInitializer()?.getText().includes("force-dynamic")) add(file.path, "dynamic route");
      const revalidate = source.getVariableDeclaration("revalidate");
      if (revalidate?.isExported() && revalidate.getInitializer() && Node.isNumericLiteral(revalidate.getInitializer())) add(file.path, "ISR is unavailable in static export");
      if (source.getDescendants().some((node) => Node.isStringLiteral(node) && node.getLiteralValue() === "use server" && Node.isExpressionStatement(node.getParent()))) add(file.path, "Server Actions");
      if (source.getImportDeclarations().some((entry) => runtimeImport(entry) && entry.getModuleSpecifierValue() === "next/headers")) add(file.path, "request headers/cookies");
      if (source.getFunction("getServerSideProps")?.isExported() || source.getVariableDeclaration("getServerSideProps")?.isExported()) add(file.path, "getServerSideProps");
      if (basename === "route") {
        for (const verb of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
          if (source.getFunction(verb)?.isExported() || source.getVariableDeclaration(verb)?.isExported()) add(file.path, `${verb} route`);
        }
        const declaration = source.getFunction("GET");
        const variable = source.getVariableDeclaration("GET");
        const initializer = variable?.getInitializer();
        const handler = declaration?.isExported() ? declaration : variable?.isExported() && initializer
          && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) ? initializer : undefined;
        if (handler && readsRequest(handler)) add(file.path, "GET reads request data");
      }
    } else if (profile === "spa") {
      const modules = runtimeModules(source);
      if (modules.some((name) => name.startsWith("react-dom/server"))) add(file.path, "server rendering");
      if (basename === "entry-server" || parts.at(-2) === "server" && (basename === "index" || basename === "app")) add(file.path, "server entrypoint");
      if (modules.some((name) => ["express", "fastify", "hono", "node:http", "node:https", "http", "https"].includes(name))) add(file.path, "own server endpoint capability");
    }
  }
  return findings;
}

function readsRequest(handler: import("ts-morph").FunctionDeclaration | import("ts-morph").ArrowFunction | import("ts-morph").FunctionExpression): boolean {
  const parameter = handler.getParameters()[0];
  const body = handler.getBody();
  if (!parameter || !body) return false;
  const name = parameter.getNameNode();
  if (!Node.isIdentifier(name)) return true;
  return name.findReferencesAsNodes().some((reference) => reference.getStart() >= body.getStart() && reference.getEnd() <= body.getEnd()
    && !reference.getAncestors().some((ancestor) => Node.isTypeNode(ancestor)));
}

function runtimeModules(source: import("ts-morph").SourceFile): string[] {
  const modules = source.getImportDeclarations().filter(runtimeImport).map((entry) => entry.getModuleSpecifierValue());
  for (const node of source.getDescendants()) {
    if (!Node.isCallExpression(node) || !["require", "import"].includes(node.getExpression().getText())) continue;
    const argument = node.getArguments()[0];
    if (argument && Node.isStringLiteral(argument)) modules.push(argument.getLiteralValue());
  }
  return modules;
}

function runtimeImport(entry: import("ts-morph").ImportDeclaration): boolean {
  if (entry.isTypeOnly()) return false;
  const named = entry.getNamedImports();
  return Boolean(entry.getDefaultImport() || entry.getNamespaceImport() || !named.length || named.some((item) => !item.isTypeOnly()));
}
