import { renderHumanReport } from "../audit/reporters/human.js";
import { incompleteAuditFindingCount, type AuditResult } from "../audit/rule.js";

export function renderBlockingReason(result: AuditResult): string {
  const incomplete = incompleteAuditFindingCount(result);
  const summary = incomplete > 0
    ? `node-boost guard could not fully audit ${incomplete} file(s) and found ${result.err} error finding(s).`
    : `node-boost guard found ${result.err} error finding(s).`;
  return `${summary}\n\n${renderHumanReport(result)}`;
}
