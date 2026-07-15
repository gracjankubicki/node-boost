import { Node, SyntaxKind } from "ts-morph";
import type { AuditFile, AuditRule } from "../rule.js";
import { callTarget, finding, isNextEntryPath, useClientDirectiveLine } from "./helpers.js";

const clientOnlyCalls = new Set([
  "createContext",
  "useCallback",
  "useContext",
  "useDeferredValue",
  "useEffect",
  "useId",
  "useImperativeHandle",
  "useLayoutEffect",
  "useMemo",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition",
]);
const browserGlobals = new Set(["document", "history", "localStorage", "navigator", "sessionStorage", "window"]);

export const serverFirstComponentRules: AuditRule[] = [
  {
    id: "NB-ARCH-003",
    code: "use-client-in-entry",
    architecture: "server-first-components",
    defaultSeverity: "err",
    stacks: ["next"],
    kind: "ast",
    check(context) {
      return context.files.flatMap((file) => {
        const line = useClientDirectiveLine(file);
        return line !== null && (isNextEntryPath(file.path, "page") || isNextEntryPath(file.path, "layout"))
          ? [finding(file, "NB-ARCH-003", "use-client-in-entry", line)]
          : [];
      });
    },
  },
  {
    id: "NB-ARCH-004",
    code: "needless-use-client",
    architecture: "server-first-components",
    defaultSeverity: "warn",
    stacks: ["next"],
    kind: "ast",
    check(context) {
      return context.files.flatMap((file) => {
        const line = useClientDirectiveLine(file);
        if (line === null) {
          return [];
        }

        return needsClientRuntime(file) ? [] : [finding(file, "NB-ARCH-004", "needless-use-client", line)];
      });
    },
  },
];

function needsClientRuntime(file: AuditFile): boolean {
  if (!file.sourceFile) {
    return false;
  }

  const hasClientCall = file.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const target = callTarget(call.getExpression());
    const name = target?.split(".").at(-1);
    return name !== undefined && (clientOnlyCalls.has(name) || isHookName(name));
  });
  if (hasClientCall) {
    return true;
  }

  const hasEventHandler = file.sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute).some((attribute) => {
    const name = attribute.getNameNode().getText();
    return name.startsWith("on") && isUppercaseLetter(name[2]);
  });
  if (hasEventHandler) {
    return true;
  }

  return file.sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => {
    const parent = identifier.getParent();
    return browserGlobals.has(identifier.getText()) && !Node.isImportSpecifier(parent);
  });
}

function isHookName(name: string): boolean {
  return name.startsWith("use") && isUppercaseLetter(name[3]);
}

function isUppercaseLetter(character: string | undefined): boolean {
  return character !== undefined && character >= "A" && character <= "Z";
}
