import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";
import type { AuditFile, AuditFinding, AuditRule } from "../rule.js";
import { finding } from "./helpers.js";

const htmlParserPackages = new Set(["html-react-parser", "react-html-parser"]);
const objectSanitizerPackages = new Set(["dompurify", "isomorphic-dompurify"]);
const callableSanitizerPackages = new Set(["sanitize-html", "xss"]);

interface HtmlBindings {
  parserFunctions: Set<string>;
  parserObjects: Set<string>;
  sanitizerFunctions: Set<string>;
  sanitizerObjects: Set<string>;
}

export const secureByDefaultRules: AuditRule[] = [
  {
    id: "NB-ARCH-011",
    code: "unsanitized-html",
    architecture: "secure-by-default",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      return context.files.flatMap(findUnsafeHtmlSinks);
    },
  },
  {
    id: "NB-ARCH-012",
    code: "public-env-secret-name",
    architecture: "secure-by-default",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "line",
    check(context) {
      return context.files.flatMap((file) =>
        file.lines.flatMap((line, index) => {
          const names = [...line.matchAll(/\b((?:NEXT_PUBLIC|VITE)_[A-Z0-9_]+)/g)].map((match) => match[1] ?? "");
          return names
            .filter((name) => /(SECRET|TOKEN|PRIVATE|PASSWORD|_KEY$)/.test(name))
            .map((name) => finding(file, "NB-ARCH-012", "public-env-secret-name", index + 1, name));
        }),
      );
    },
  },
];

function findUnsafeHtmlSinks(file: AuditFile): AuditFinding[] {
  const sourceFile = file.sourceFile;
  if (!sourceFile) {
    return [];
  }

  const bindings = collectHtmlBindings(sourceFile);
  const findings: AuditFinding[] = [];
  const reportedStarts = new Set<number>();

  for (const attribute of sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
    if (attribute.getNameNode().getText() !== "dangerouslySetInnerHTML") {
      continue;
    }

    const initializer = attribute.getInitializer();
    const expression = initializer && Node.isJsxExpression(initializer) ? initializer.getExpression() : undefined;
    const value = expression ? rawHtmlValue(expression, sourceFile) : undefined;
    reportIfUnsafe(file, attribute, value, sourceFile, bindings, findings, reportedStarts);
  }

  for (const spread of sourceFile.getDescendantsOfKind(SyntaxKind.JsxSpreadAttribute)) {
    const spreadObject = resolveExpression(spread.getExpression(), sourceFile);
    if (!spreadObject || !Node.isObjectLiteralExpression(spreadObject)) {
      continue;
    }

    const property = spreadObject.getProperty("dangerouslySetInnerHTML");
    if (!property || !Node.isPropertyAssignment(property)) {
      continue;
    }

    const value = rawHtmlValue(property.getInitializer(), sourceFile);
    reportIfUnsafe(file, property, value, sourceFile, bindings, findings, reportedStarts);
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!isHtmlParserCall(call.getExpression(), bindings)) {
      continue;
    }

    reportIfUnsafe(file, call, call.getArguments()[0], sourceFile, bindings, findings, reportedStarts);
  }

  return findings;
}

function reportIfUnsafe(
  file: AuditFile,
  node: Node,
  value: Node | undefined,
  sourceFile: SourceFile,
  bindings: HtmlBindings,
  findings: AuditFinding[],
  reportedStarts: Set<number>,
): void {
  if ((value && isSafeHtmlExpression(value, sourceFile, bindings, new Set())) || reportedStarts.has(node.getStart())) {
    return;
  }

  reportedStarts.add(node.getStart());
  findings.push(finding(file, "NB-ARCH-011", "unsanitized-html", node.getStartLineNumber()));
}

function collectHtmlBindings(sourceFile: SourceFile): HtmlBindings {
  const bindings: HtmlBindings = {
    parserFunctions: new Set(),
    parserObjects: new Set(),
    sanitizerFunctions: new Set(),
    sanitizerObjects: new Set(),
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    const moduleName = declaration.getModuleSpecifierValue();
    const defaultImport = declaration.getDefaultImport()?.getText();
    const namespaceImport = declaration.getNamespaceImport()?.getText();

    if (htmlParserPackages.has(moduleName)) {
      if (defaultImport) bindings.parserFunctions.add(defaultImport);
      if (namespaceImport) bindings.parserObjects.add(namespaceImport);
    }

    if (objectSanitizerPackages.has(moduleName)) {
      if (defaultImport) bindings.sanitizerObjects.add(defaultImport);
      if (namespaceImport) bindings.sanitizerObjects.add(namespaceImport);
    }

    if (callableSanitizerPackages.has(moduleName)) {
      if (defaultImport) bindings.sanitizerFunctions.add(defaultImport);
      if (namespaceImport) bindings.sanitizerFunctions.add(namespaceImport);
    }

    for (const namedImport of declaration.getNamedImports()) {
      const importedName = namedImport.getName();
      const localName = namedImport.getAliasNode()?.getText() ?? importedName;

      if (htmlParserPackages.has(moduleName) && importedName === "parse") {
        bindings.parserFunctions.add(localName);
      }

      if (objectSanitizerPackages.has(moduleName) && importedName === "sanitize") {
        bindings.sanitizerFunctions.add(localName);
      }

      if (callableSanitizerPackages.has(moduleName)) {
        bindings.sanitizerFunctions.add(localName);
      }
    }
  }

  return bindings;
}

function rawHtmlValue(expression: Expression | undefined, sourceFile: SourceFile): Expression | undefined {
  if (!expression) {
    return undefined;
  }

  const resolved = resolveExpression(expression, sourceFile);
  if (!resolved || !Node.isObjectLiteralExpression(resolved)) {
    return undefined;
  }

  const property = resolved.getProperty("__html");
  return property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
}

function resolveExpression(expression: Expression, sourceFile: SourceFile): Expression | undefined {
  const current = unwrapExpression(expression);

  if (!Node.isIdentifier(current)) {
    return current;
  }

  return sourceFile.getVariableDeclaration(current.getText())?.getInitializer() ?? current;
}

function isSafeHtmlExpression(
  value: Node,
  sourceFile: SourceFile,
  bindings: HtmlBindings,
  visited: Set<string>,
): boolean {
  if (!Node.isExpression(value)) {
    return false;
  }

  const expression = unwrapExpression(value);

  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return true;
  }

  if (Node.isCallExpression(expression)) {
    return isSanitizerCall(expression.getExpression(), bindings);
  }

  if (!Node.isIdentifier(expression)) {
    return false;
  }

  const name = expression.getText();
  if (visited.has(name)) {
    return false;
  }

  visited.add(name);
  const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  return initializer ? isSafeHtmlExpression(initializer, sourceFile, bindings, visited) : false;
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression;

  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isNonNullExpression(current) ||
    Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }

  return current;
}

function isHtmlParserCall(expression: Expression, bindings: HtmlBindings): boolean {
  if (Node.isIdentifier(expression)) {
    return bindings.parserFunctions.has(expression.getText());
  }

  return (
    Node.isPropertyAccessExpression(expression) &&
    bindings.parserObjects.has(expression.getExpression().getText()) &&
    expression.getName() === "default"
  );
}

function isSanitizerCall(expression: Expression, bindings: HtmlBindings): boolean {
  if (Node.isIdentifier(expression)) {
    return bindings.sanitizerFunctions.has(expression.getText());
  }

  return (
    Node.isPropertyAccessExpression(expression) &&
    bindings.sanitizerObjects.has(expression.getExpression().getText()) &&
    expression.getName() === "sanitize"
  );
}
