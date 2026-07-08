import type { AuditFile, AuditFinding } from "./rule.js";

const suppressionPattern = /nb-disable\s+(NB-[A-Z]+-\d{3})\s*(?:--\s*(.+))?/;

export interface SuppressionIndex {
  suppresses(file: string, line: number, rule: string): boolean;
  metaFindings: AuditFinding[];
}

export function buildSuppressionIndex(files: AuditFile[]): SuppressionIndex {
  const lineSuppressions = new Map<string, Set<string>>();
  const fileSuppressions = new Map<string, Set<string>>();
  const metaFindings: AuditFinding[] = [];

  for (const file of files) {
    let beforeImports = true;

    file.lines.forEach((line, index) => {
      const lineNo = index + 1;
      const trimmed = line.trim();
      const match = trimmed.match(suppressionPattern);

      if (match) {
        const [, rule = "", reason = ""] = match;
        if (!reason.trim()) {
          metaFindings.push({
            rule: "NB-META-001",
            sev: "warn",
            file: file.path,
            line: lineNo,
            code: "suppression-without-reason",
          });
        }

        if (beforeImports) {
          addSuppression(fileSuppressions, file.path, rule);
        }

        addSuppression(lineSuppressions, lineKey(file.path, lineNo), rule);
        addSuppression(lineSuppressions, lineKey(file.path, lineNo + 1), rule);
      }

      if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")) {
        beforeImports = !trimmed.startsWith("import ");
      }
    });
  }

  return {
    metaFindings,
    suppresses(file, line, rule) {
      return Boolean(fileSuppressions.get(file)?.has(rule) || lineSuppressions.get(lineKey(file, line))?.has(rule));
    },
  };
}

function addSuppression(map: Map<string, Set<string>>, key: string, rule: string): void {
  const current = map.get(key) ?? new Set<string>();
  current.add(rule);
  map.set(key, current);
}

function lineKey(file: string, line: number): string {
  return `${file}:${line}`;
}
