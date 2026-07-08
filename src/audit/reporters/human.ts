import type { AuditResult } from "../rule.js";

export function renderHumanReport(result: AuditResult): string {
  const lines = result.findings.map((finding) => {
    const ref = finding.ref ? ` -> ${finding.ref}` : "";
    return `${finding.file}:${finding.line} | ${finding.rule} | ${finding.sev} | ${finding.code}${ref}`;
  });

  lines.push(
    `summary | scanned=${result.scanned} skipped=${result.skipped} suppressed=${result.suppressed} err=${result.err} warn=${result.warn} time=${result.elapsedMs}ms`,
  );

  return `${lines.join("\n")}\n`;
}
