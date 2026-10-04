import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Node, Project, type Expression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

export interface RenderingFacts { output: string | null; ssr: boolean | null; unknown: boolean; source: string | null }

/** Static syntax only. Never import/evaluate consumer configuration. */
export async function detectRendering(root: string, stack: "next" | "vite-react"): Promise<RenderingFacts> {
  const prefix = stack === "next" ? "next" : "vite";
  for (const extension of ["ts", "mts", "cts", "js", "mjs", "cjs"]) {
    const path = `${prefix}.config.${extension}`;
    let content: string;
    try { content = await readFile(join(root, path), "utf8"); } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true, compilerOptions: { allowJs: true } });
    const file = project.createSourceFile(path, content);
    const exported = file.getExportAssignments().find((entry) => !entry.isExportEquals())?.getExpression()
      ?? file.getDescendants().find((entry) => Node.isBinaryExpression(entry) && entry.getLeft().getText() === "module.exports");
    const expression = exported && Node.isBinaryExpression(exported) ? exported.getRight() : exported;
    const object = expression ? configObject(expression as Expression, file, new Set()) : undefined;
    if (!object || object.getProperties().some(Node.isSpreadAssignment)) return { output: null, ssr: null, unknown: true, source: path };
    const value = object.getProperty("output");
    const output = value && Node.isPropertyAssignment(value) ? value.getInitializer() : undefined;
    const build = object.getProperty("build");
    const buildValue = build && Node.isPropertyAssignment(build) ? build.getInitializer() : undefined;
    const ssrProperty = buildValue && Node.isObjectLiteralExpression(buildValue) ? buildValue.getProperty("ssr") : undefined;
    const ssr = ssrProperty && Node.isPropertyAssignment(ssrProperty) ? ssrProperty.getInitializer() : undefined;
    const unknownBuild = Boolean(build && !buildValue) || Boolean(buildValue && (!Node.isObjectLiteralExpression(buildValue)
      || buildValue.getProperties().some(Node.isSpreadAssignment))) || Boolean(ssrProperty && !ssr);
    return {
      output: output && Node.isStringLiteral(output) ? output.getLiteralValue() : null,
      ssr: unknownBuild ? null : ssr ? Node.isFalseLiteral(ssr) ? false : Node.isTrueLiteral(ssr) || Node.isStringLiteral(ssr) ? true : null : false,
      unknown: Boolean(value && !output) || Boolean(output && !Node.isStringLiteral(output)) || unknownBuild
        || Boolean(ssr && !Node.isFalseLiteral(ssr) && !Node.isTrueLiteral(ssr) && !Node.isStringLiteral(ssr)),
      source: path,
    };
  }
  return { output: null, ssr: false, unknown: false, source: null };
}

function configObject(expression: Expression, file: SourceFile, seen: Set<string>): ObjectLiteralExpression | undefined {
  if (Node.isObjectLiteralExpression(expression)) return expression;
  if (Node.isAsExpression(expression) || Node.isSatisfiesExpression(expression) || Node.isParenthesizedExpression(expression)) return configObject(expression.getExpression(), file, seen);
  if (Node.isIdentifier(expression) && !seen.has(expression.getText())) {
    seen.add(expression.getText());
    const initializer = file.getVariableDeclaration(expression.getText())?.getInitializer();
    return initializer ? configObject(initializer, file, seen) : undefined;
  }
  if (Node.isCallExpression(expression) && expression.getExpression().getText() === "defineConfig") {
    const argument = expression.getArguments()[0];
    return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined;
  }
  return undefined;
}
