import { ts } from "ts-morph";
import type { AuditFile, AuditFinding } from "./rule.js";

const directiveName = "nb-disable";

export interface SuppressionIndex {
  suppresses(file: string, line: number, rule: string): boolean;
  metaFindings: AuditFinding[];
}

interface SuppressionDirective {
  rule: string;
  reason: string;
  line: number;
  fileLevel: boolean;
}

export function buildSuppressionIndex(files: AuditFile[]): SuppressionIndex {
  const lineSuppressions = new Map<string, Set<string>>();
  const fileSuppressions = new Map<string, Set<string>>();
  const metaFindings: AuditFinding[] = [];

  for (const file of files) {
    for (const directive of scanDirectives(file.content)) {
      if (!directive.reason) {
        metaFindings.push({
          rule: "NB-META-001",
          sev: "warn",
          file: file.path,
          line: directive.line,
          code: "suppression-without-reason",
        });
      }

      if (directive.fileLevel) {
        addSuppression(fileSuppressions, file.path, directive.rule);
      }

      addSuppression(lineSuppressions, lineKey(file.path, directive.line), directive.rule);
      addSuppression(lineSuppressions, lineKey(file.path, directive.line + 1), directive.rule);
    }
  }

  return {
    metaFindings,
    suppresses(file, line, rule) {
      return Boolean(fileSuppressions.get(file)?.has(rule) || lineSuppressions.get(lineKey(file, line))?.has(rule));
    },
  };
}

function scanDirectives(content: string): SuppressionDirective[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.JSX, content);
  const directives: SuppressionDirective[] = [];
  let headerOpen = true;
  let token = scanner.scan();

  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
      directives.push(...directivesFromComment(scanner.getTokenText(), scanner.getTokenPos(), content, headerOpen));
    } else if (!isTrivia(token)) {
      headerOpen = false;
    }

    token = scanner.scan();
  }

  return directives;
}

function directivesFromComment(comment: string, position: number, source: string, fileLevel: boolean): SuppressionDirective[] {
  const bodyStart = position + 2;
  const bodyEnd = comment.startsWith("/*") ? position + comment.length - 2 : position + comment.length;
  const directives: SuppressionDirective[] = [];
  let lineStart = bodyStart;

  for (let index = bodyStart; index <= bodyEnd; index += 1) {
    const atEnd = index === bodyEnd;
    const atLineBreak = !atEnd && source[index] === "\n";
    if (!atEnd && !atLineBreak) {
      continue;
    }

    const rawLine = source.slice(lineStart, index).replaceAll("\r", "");
    const directive = parseDirectiveLine(rawLine, lineNumberAt(source, lineStart), fileLevel);
    if (directive) {
      directives.push(directive);
    }
    lineStart = index + 1;
  }

  return directives;
}

function parseDirectiveLine(rawLine: string, line: number, fileLevel: boolean): SuppressionDirective | null {
  let content = rawLine.trim();
  if (content.startsWith("*")) {
    content = content.slice(1).trimStart();
  }

  if (!content.startsWith(directiveName)) {
    return null;
  }

  const remainder = content.slice(directiveName.length).trimStart();
  const separator = remainder.indexOf("--");
  const rule = (separator === -1 ? remainder : remainder.slice(0, separator)).trim();
  const reason = separator === -1 ? "" : remainder.slice(separator + 2).trim();

  return isRuleId(rule) ? { rule, reason, line, fileLevel } : null;
}

function isRuleId(value: string): boolean {
  const parts = value.split("-");
  if (parts.length !== 3 || parts[0] !== "NB" || parts[2]?.length !== 3) {
    return false;
  }

  const category = parts[1] ?? "";
  const digits = parts[2] ?? "";
  return category.length > 0
    && [...category].every(isUppercaseLetter)
    && [...digits].every(isDigit);
}

function isUppercaseLetter(character: string): boolean {
  return character >= "A" && character <= "Z";
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isTrivia(kind: ts.SyntaxKind): boolean {
  return kind === ts.SyntaxKind.WhitespaceTrivia
    || kind === ts.SyntaxKind.NewLineTrivia
    || kind === ts.SyntaxKind.ShebangTrivia
    || kind === ts.SyntaxKind.ConflictMarkerTrivia;
}

function lineNumberAt(source: string, position: number): number {
  let line = 1;
  for (let index = 0; index < position; index += 1) {
    if (source[index] === "\n") {
      line += 1;
    }
  }
  return line;
}

function addSuppression(map: Map<string, Set<string>>, key: string, rule: string): void {
  const current = map.get(key) ?? new Set<string>();
  current.add(rule);
  map.set(key, current);
}

function lineKey(file: string, line: number): string {
  return `${file}:${line}`;
}
