import type { AuditResult } from "../rule.js";

export function renderAgentReport(result: AuditResult): string {
  return `${JSON.stringify({
    v: result.v,
    ok: result.ok,
    cmd: result.cmd,
    scope: result.scope,
    err: result.err,
    warn: result.warn,
    scanned: result.scanned,
    skipped: result.skipped,
    findings: result.findings,
  })}\n`;
}
