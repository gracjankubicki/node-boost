import { renderHumanReport } from "../audit/reporters/human.js";
import type { AuditResult } from "../audit/rule.js";

export function renderBlockingReason(result: AuditResult): string {
  return `node-boost guard found ${result.err} error finding(s).\n\n${renderHumanReport(result)}`;
}
