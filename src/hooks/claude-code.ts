import { auditGateFailed, type AuditResult } from "../audit/rule.js";
import type { HookResponse } from "./adapter.js";
import { renderBlockingReason } from "./report.js";

export function formatClaudeCodeHook(result: AuditResult): HookResponse {
  if (auditGateFailed(result)) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: renderBlockingReason(result),
    };
  }

  return { exitCode: 0, stdout: "", stderr: "" };
}
