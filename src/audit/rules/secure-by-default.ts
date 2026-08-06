import { Node, SyntaxKind, type Expression, type Identifier, type SourceFile } from "ts-morph";
import {
  callableSanitizerPackageNames,
  htmlParserPackageNames,
  objectSanitizerPackageNames,
} from "../../ecosystem/packages.js";
import type { AuditFile, AuditFinding, AuditRule } from "../rule.js";
import { callTarget, environmentAccesses, finding } from "./helpers.js";

const htmlParserPackages = new Set<string>(htmlParserPackageNames);
const objectSanitizerPackages = new Set<string>(objectSanitizerPackageNames);
const callableSanitizerPackages = new Set<string>(callableSanitizerPackageNames);

interface HtmlBindings {
  parserFunctions: Set<string>;
  parserObjects: Set<string>;
  sanitizerFunctions: Set<string>;
  sanitizerObjects: Set<string>;
  configuredSanitizers: Set<string>;
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
      const configuredSanitizers = sanitizerTargets(context.ruleOptions);
      return context.files.flatMap((file) => findUnsafeHtmlSinks(file, configuredSanitizers));
    },
  },
  {
    id: "NB-ARCH-012",
    code: "public-env-secret-name",
    architecture: "secure-by-default",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      return context.files.flatMap((file) => environmentAccesses(file)
        .filter((access) => access.public && looksSecret(access.name))
        .map((access) => finding(file, "NB-ARCH-012", "public-env-secret-name", access.line, access.name)));
    },
  },
];

function findUnsafeHtmlSinks(file: AuditFile, configuredSanitizers: Set<string>): AuditFinding[] {
  const sourceFile = file.sourceFile;
  if (!sourceFile) {
    return [];
  }

  const bindings = collectHtmlBindings(sourceFile, configuredSanitizers);
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

    reportIfUnsafe(
      file,
      property,
      rawHtmlValue(property.getInitializer(), sourceFile),
      sourceFile,
      bindings,
      findings,
      reportedStarts,
    );
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (isHtmlParserCall(call.getExpression(), bindings)) {
      reportIfUnsafe(file, call, call.getArguments()[0], sourceFile, bindings, findings, reportedStarts);
    }
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

function collectHtmlBindings(sourceFile: SourceFile, configuredSanitizers: Set<string>): HtmlBindings {
  const bindings: HtmlBindings = {
    parserFunctions: new Set(),
    parserObjects: new Set(),
    sanitizerFunctions: new Set(),
    sanitizerObjects: new Set(),
    configuredSanitizers,
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

      if (htmlParserPackages.has(moduleName) && (importedName === "parse" || importedName === "default")) {
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
  if (property && Node.isPropertyAssignment(property)) {
    return property.getInitializer();
  }
  if (property && Node.isShorthandPropertyAssignment(property)) {
    return sourceFile.getVariableDeclaration(property.getName())?.getInitializer();
  }
  return undefined;
}

function resolveExpression(expression: Expression, sourceFile: SourceFile): Expression | undefined {
  const current = unwrapExpression(expression);
  if (!Node.isIdentifier(current)) {
    return current;
  }

  return current.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration)?.getInitializer()
    ?? sourceFile.getVariableDeclaration(current.getText())?.getInitializer()
    ?? current;
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
  if (visited.has(name) || identifierHasWriteBefore(expression)) {
    return false;
  }
  visited.add(name);
  const initializer = resolveExpression(expression, sourceFile);
  return initializer && initializer !== expression
    ? isSafeHtmlExpression(initializer, sourceFile, bindings, visited)
    : false;
}

function identifierHasWriteBefore(identifier: Identifier): boolean {
  return identifier.findReferencesAsNodes().some((reference) =>
    reference.getSourceFile() === identifier.getSourceFile()
    && reference.getStart() < identifier.getStart()
    && isWriteReference(reference),
  );
}

function isWriteReference(reference: Node): boolean {
  const update = reference.getParent();
  if (
    update
    && (Node.isPrefixUnaryExpression(update) || Node.isPostfixUnaryExpression(update))
    && (update.getOperatorToken() === SyntaxKind.PlusPlusToken || update.getOperatorToken() === SyntaxKind.MinusMinusToken)
  ) {
    return true;
  }

  const binary = reference.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
  if (binary) {
    const operator = binary.getOperatorToken().getKind();
    const left = binary.getLeft();
    if (
      operator >= SyntaxKind.FirstAssignment
      && operator <= SyntaxKind.LastAssignment
      && reference.getStart() >= left.getStart()
      && reference.getEnd() <= left.getEnd()
    ) {
      return true;
    }
  }

  const forIn = reference.getFirstAncestorByKind(SyntaxKind.ForInStatement);
  if (forIn && reference.getStart() >= forIn.getInitializer().getStart() && reference.getEnd() <= forIn.getInitializer().getEnd()) {
    return true;
  }
  const forOf = reference.getFirstAncestorByKind(SyntaxKind.ForOfStatement);
  return Boolean(
    forOf
    && reference.getStart() >= forOf.getInitializer().getStart()
    && reference.getEnd() <= forOf.getInitializer().getEnd(),
  );
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression;
  while (
    Node.isParenthesizedExpression(current)
    || Node.isAsExpression(current)
    || Node.isTypeAssertion(current)
    || Node.isNonNullExpression(current)
    || Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

function isHtmlParserCall(expression: Expression, bindings: HtmlBindings): boolean {
  if (Node.isIdentifier(expression)) {
    return bindings.parserFunctions.has(expression.getText());
  }
  return Node.isPropertyAccessExpression(expression)
    && bindings.parserObjects.has(expression.getExpression().getText())
    && (expression.getName() === "default" || expression.getName() === "parse");
}

function isSanitizerCall(expression: Expression, bindings: HtmlBindings): boolean {
  const target = callTarget(expression);
  if (target && bindings.configuredSanitizers.has(target)) {
    return true;
  }
  if (Node.isIdentifier(expression)) {
    return bindings.sanitizerFunctions.has(expression.getText());
  }
  return Node.isPropertyAccessExpression(expression)
    && bindings.sanitizerObjects.has(expression.getExpression().getText())
    && expression.getName() === "sanitize";
}

function sanitizerTargets(options: Record<string, unknown>): Set<string> {
  const configured = options.sanitizers;
  return new Set(
    Array.isArray(configured)
      ? configured.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [],
  );
}

function looksSecret(name: string): boolean {
  return name.includes("SECRET")
    || name.includes("TOKEN")
    || name.includes("PRIVATE")
    || name.includes("PASSWORD")
    || name.endsWith("_KEY");
}
