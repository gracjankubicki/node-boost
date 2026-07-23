import { Node, SyntaxKind, type CallExpression, type Expression, type SourceFile } from "ts-morph";
import type { AuditFile, AuditRule } from "../rule.js";
import { dataLayerGlobs, environmentAccesses, finding, isConfigFile, isDataLayerFile } from "./helpers.js";

const runtimeSchemaPackages = new Set(["zod", "valibot"]);

interface ValidatorBindings {
  functions: Set<string>;
  namespaces: Set<string>;
  schemas: Set<string>;
}

export const typedContractRules: AuditRule[] = [
  {
    id: "NB-ARCH-007",
    code: "unvalidated-boundary",
    architecture: "typed-contracts",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const globs = dataLayerGlobs(context.ruleOptions);
      const configuredValidators = runtimeValidatorFunctions(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (!isDataLayerFile(file, globs) || isGeneratedFile(file) || !file.sourceFile) {
          return [];
        }

        return unvalidatedBoundaryFindings(file, configuredValidators);
      });
    },
  },
  {
    id: "NB-ARCH-008",
    code: "env-outside-env-file",
    architecture: "typed-contracts",
    defaultSeverity: "warn",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const envFiles = envFileGlobs(context.ruleOptions);
      return context.files.flatMap((file) => {
        if (isConfigFile(file.path) || envFiles.some((envFile) => file.path.endsWith(envFile))) {
          return [];
        }

        return environmentAccesses(file)
          .filter((access) => access.name !== "NODE_ENV")
          .map((access) => finding(file, "NB-ARCH-008", "env-outside-env-file", access.line, access.name));
      });
    },
  },
];

function unvalidatedBoundaryFindings(file: AuditFile, configuredValidators: Set<string>) {
  const sourceFile = file.sourceFile as SourceFile;
  const bindings = collectValidatorBindings(sourceFile, configuredValidators);

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isJsonBoundaryCall)
    .filter((call) => !isBoundaryValidated(call, sourceFile, bindings))
    .map((call) => finding(file, "NB-ARCH-007", "unvalidated-boundary", call.getStartLineNumber()));
}

function isJsonBoundaryCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (expression.getExpression().getText() === "JSON" && expression.getName() === "parse") {
    return true;
  }

  return expression.getName() === "json"
    && call.getArguments().length === 0
    && call.getFirstAncestorByKind(SyntaxKind.AwaitExpression) !== undefined;
}

function isBoundaryValidated(boundary: CallExpression, sourceFile: SourceFile, bindings: ValidatorBindings): boolean {
  if (boundary.getAncestors().filter(Node.isCallExpression).some((call) =>
    isValidatorCall(call, bindings)
    && directlyConsumesNode(call, boundary)
    && validatorResultIsUsed(call, sourceFile),
  )) {
    return true;
  }

  const declaration = boundary.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const nameNode = declaration?.getNameNode();
  if (!declaration || !nameNode || !Node.isIdentifier(nameNode)) {
    return false;
  }

  const variableName = nameNode.getText();
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    isValidatorCall(call, bindings)
    && call.getStart() > declaration.getEnd()
    && sameLexicalBlock(declaration, call)
    && validatorResultIsUsed(call, sourceFile)
    && call.getArguments().some((argument) => directlyReferencesIdentifier(argument, variableName))
    && !identifierIsUsedBeforeCall(nameNode, declaration, call)
    && !identifierIsUsedAfterCall(nameNode, call),
  );
}

function collectValidatorBindings(sourceFile: SourceFile, configuredValidators: Set<string>): ValidatorBindings {
  const bindings: ValidatorBindings = {
    functions: new Set(configuredValidators),
    namespaces: new Set(),
    schemas: new Set(),
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    const moduleName = declaration.getModuleSpecifierValue();
    const schemaPackage = runtimeSchemaPackages.has(moduleName);
    const localSchemaModule = moduleName.startsWith(".");
    const defaultImport = declaration.getDefaultImport();
    const namespaceImport = declaration.getNamespaceImport();

    if (schemaPackage && defaultImport) bindings.namespaces.add(defaultImport.getText());
    if (schemaPackage && namespaceImport) bindings.namespaces.add(namespaceImport.getText());

    for (const namedImport of declaration.getNamedImports()) {
      const importedName = namedImport.getName();
      const localName = namedImport.getAliasNode()?.getText() ?? importedName;
      if (schemaPackage && (importedName === "parse" || importedName === "safeParse")) {
        bindings.functions.add(localName);
      }
      if (schemaPackage && importedName === "z") {
        bindings.namespaces.add(localName);
      }
      if (localSchemaModule && looksLikeSchemaName(localName)) {
        bindings.schemas.add(localName);
      }
    }
  }

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const name = declaration.getNameNode();
    const initializer = declaration.getInitializer();
    if (Node.isIdentifier(name) && initializer && isSchemaFactoryExpression(initializer, bindings)) {
      bindings.schemas.add(name.getText());
    }
  }

  return bindings;
}

function isValidatorCall(call: CallExpression, bindings: ValidatorBindings): boolean {
  const expression = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(expression)) {
    return bindings.functions.has(expression.getText());
  }
  if (!Node.isPropertyAccessExpression(expression)) {
    return false;
  }

  const method = expression.getName();
  if (method !== "parse" && method !== "safeParse") {
    return false;
  }

  return isSchemaExpression(expression.getExpression(), bindings);
}

function isSchemaExpression(expression: Expression, bindings: ValidatorBindings): boolean {
  const current = unwrapExpression(expression);
  if (Node.isIdentifier(current)) {
    return bindings.schemas.has(current.getText()) || looksLikeSchemaName(current.getText());
  }
  if (Node.isCallExpression(current)) {
    return isSchemaFactoryExpression(current, bindings);
  }
  return false;
}

function isSchemaFactoryExpression(expression: Expression, bindings: ValidatorBindings): boolean {
  const current = unwrapExpression(expression);
  if (!Node.isCallExpression(current)) {
    return false;
  }

  const target = unwrapExpression(current.getExpression());
  return Node.isPropertyAccessExpression(target)
    && Node.isIdentifier(target.getExpression())
    && bindings.namespaces.has(target.getExpression().getText());
}

function validatorResultIsUsed(call: CallExpression, sourceFile: SourceFile): boolean {
  let parent = call.getParent();
  while (
    parent
    && (Node.isParenthesizedExpression(parent)
      || Node.isAsExpression(parent)
      || Node.isTypeAssertion(parent)
      || Node.isNonNullExpression(parent)
      || Node.isSatisfiesExpression(parent))
  ) {
    parent = parent.getParent();
  }

  if (!parent || Node.isExpressionStatement(parent)) {
    return false;
  }
  if (!Node.isVariableDeclaration(parent)) {
    return true;
  }

  const nameNode = parent.getNameNode();
  if (!Node.isIdentifier(nameNode)) {
    return true;
  }
  return nameNode.findReferencesAsNodes().some((reference) =>
    reference.getSourceFile() === sourceFile && reference.getStart() > call.getEnd(),
  );
}

function directlyConsumesNode(call: CallExpression, target: Node): boolean {
  return call.getArguments().some((argument) => unwrapDirectValue(argument).compilerNode === target.compilerNode);
}

function directlyReferencesIdentifier(node: Node, identifierName: string): boolean {
  const directValue = unwrapDirectValue(node);
  return Node.isIdentifier(directValue) && directValue.getText() === identifierName;
}

function unwrapDirectValue(node: Node): Node {
  let current = node;
  while (
    Node.isParenthesizedExpression(current)
    || Node.isAsExpression(current)
    || Node.isTypeAssertion(current)
    || Node.isNonNullExpression(current)
    || Node.isSatisfiesExpression(current)
    || Node.isAwaitExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

function sameLexicalBlock(first: Node, second: Node): boolean {
  const firstBlock = first.getFirstAncestorByKind(SyntaxKind.Block);
  const secondBlock = second.getFirstAncestorByKind(SyntaxKind.Block);
  if (!firstBlock || !secondBlock) {
    return !firstBlock && !secondBlock && first.getSourceFile() === second.getSourceFile();
  }
  return firstBlock.compilerNode === secondBlock.compilerNode;
}

function identifierIsUsedAfterCall(identifier: Node, call: CallExpression): boolean {
  if (!Node.isIdentifier(identifier)) {
    return true;
  }
  return identifier.findReferencesAsNodes().some((reference) =>
    reference.getSourceFile() === call.getSourceFile()
    && reference.getStart() > call.getEnd(),
  );
}

function identifierIsUsedBeforeCall(identifier: Node, declaration: Node, call: CallExpression): boolean {
  if (!Node.isIdentifier(identifier)) {
    return true;
  }
  return identifier.findReferencesAsNodes().some((reference) =>
    reference.getSourceFile() === call.getSourceFile()
    && reference.getStart() > declaration.getEnd()
    && reference.getStart() < call.getStart(),
  );
}

function isGeneratedFile(file: AuditFile): boolean {
  const segments = file.path.replaceAll("\\", "/").split("/");
  if (segments.includes("generated") || segments.includes("__generated__")) {
    return true;
  }

  const firstStatement = file.sourceFile?.getStatements()[0];
  const comments = firstStatement?.getLeadingCommentRanges().map((comment) => comment.getText().toLowerCase()) ?? [];
  return comments.some((comment) =>
    comment.includes("@generated")
    || comment.includes("generated by orval")
    || comment.includes("generated by openapi"),
  );
}

function looksLikeSchemaName(name: string): boolean {
  return name.toLowerCase().endsWith("schema");
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

function runtimeValidatorFunctions(options: Record<string, unknown>): Set<string> {
  const configured = options.runtimeValidatorFunctions;
  return new Set(
    Array.isArray(configured) && configured.every((item) => typeof item === "string") ? configured : [],
  );
}

function envFileGlobs(options: Record<string, unknown>): string[] {
  const configured = options.envFiles;
  return Array.isArray(configured) && configured.every((item) => typeof item === "string") ? configured : ["env.ts", "env.mjs"];
}
