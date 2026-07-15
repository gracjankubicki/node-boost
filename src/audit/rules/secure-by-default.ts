import { Node, SyntaxKind, type Expression, type Identifier } from "ts-morph";
import type { AuditRule } from "../rule.js";
import { environmentAccesses, finding } from "./helpers.js";

const defaultSanitizers = ["DOMPurify.sanitize"];

export const secureByDefaultRules: AuditRule[] = [
  {
    id: "NB-ARCH-011",
    code: "unsanitized-html",
    architecture: "secure-by-default",
    defaultSeverity: "err",
    stacks: ["next", "vite-react"],
    kind: "ast",
    check(context) {
      const sanitizers = configuredSanitizers(context.ruleOptions);

      return context.files.flatMap((file) => {
        if (!file.sourceFile) {
          return [];
        }

        return file.sourceFile
          .getDescendantsOfKind(SyntaxKind.JsxAttribute)
          .filter((attribute) => attribute.getNameNode().getText() === "dangerouslySetInnerHTML")
          .flatMap((attribute) => {
            const initializer = attribute.getInitializer();
            const props = initializer && Node.isJsxExpression(initializer) ? initializer.getExpression() : undefined;
            const html = props ? resolveHtmlValue(props, new Set()) : undefined;

            return html && isSafeHtmlValue(html, sanitizers, new Set())
              ? []
              : [finding(file, "NB-ARCH-011", "unsanitized-html", attribute.getStartLineNumber())];
          });
      });
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

function looksSecret(name: string): boolean {
  return name.includes("SECRET")
    || name.includes("TOKEN")
    || name.includes("PRIVATE")
    || name.includes("PASSWORD")
    || name.endsWith("_KEY");
}

function configuredSanitizers(options: Record<string, unknown>): Set<string> {
  const configured = options.sanitizers;
  const additions = Array.isArray(configured)
    ? configured.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  return new Set([...defaultSanitizers, ...additions]);
}

function resolveHtmlValue(expression: Expression, seen: Set<Node>): Expression | undefined {
  const current = unwrapExpression(expression);
  if (seen.has(current)) {
    return undefined;
  }
  seen.add(current);

  if (Node.isObjectLiteralExpression(current)) {
    const property = current.getProperty("__html");
    if (Node.isPropertyAssignment(property)) {
      return property.getInitializer();
    }
    if (Node.isShorthandPropertyAssignment(property)) {
      return resolveIdentifier(property.getNameNode());
    }
    return undefined;
  }

  if (Node.isIdentifier(current)) {
    const initializer = resolveIdentifier(current);
    return initializer ? resolveHtmlValue(initializer, seen) : undefined;
  }

  return undefined;
}

function isSafeHtmlValue(expression: Expression, sanitizers: Set<string>, seen: Set<Node>): boolean {
  const current = unwrapExpression(expression);
  if (seen.has(current)) {
    return false;
  }
  seen.add(current);

  if (Node.isStringLiteral(current) || Node.isNoSubstitutionTemplateLiteral(current)) {
    return true;
  }

  if (Node.isCallExpression(current)) {
    const target = callTarget(current.getExpression());
    return target !== undefined && sanitizers.has(target);
  }

  if (Node.isIdentifier(current)) {
    const initializer = resolveIdentifier(current);
    return initializer ? isSafeHtmlValue(initializer, sanitizers, seen) : false;
  }

  return false;
}

function resolveIdentifier(identifier: Identifier): Expression | undefined {
  const declaration = identifier.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration);
  return declaration?.getInitializer();
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

function callTarget(expression: Expression): string | undefined {
  const current = unwrapExpression(expression);
  if (Node.isIdentifier(current)) {
    return current.getText();
  }
  if (Node.isPropertyAccessExpression(current)) {
    const owner = callTarget(current.getExpression());
    return owner ? `${owner}.${current.getName()}` : undefined;
  }

  return undefined;
}
