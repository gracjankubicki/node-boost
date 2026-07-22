import { describe, expect, it } from "vitest";
import { auditGateFailed, incompleteAuditFindingCount, type AuditResult } from "../../src/audit/rule.js";

const incompleteCodes = ["parse-error", "parse-timeout", "file-too-large", "file-disappeared"];

describe("audit gate", () => {
  it.each(incompleteCodes)("fails closed for %s", (code) => {
    const result: AuditResult = {
      v: 1,
      ok: true,
      cmd: "audit",
      scope: "changed",
      err: 0,
      warn: 1,
      scanned: 0,
      skipped: 1,
      suppressed: 0,
      elapsedMs: 1,
      findings: [{ rule: "NB-META-003", sev: "warn", file: "src/example.ts", line: 1, code }],
    };

    expect(auditGateFailed(result)).toBe(true);
    expect(incompleteAuditFindingCount(result)).toBe(1);
  });
});
