import type { AuditResult } from "../audit/rule.js";
import type { HookResponse } from "./adapter.js";
import { renderBlockingReason } from "./report.js";

export function formatCodexHook(result: AuditResult): HookResponse {
  if (result.err > 0) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify({ continue: false, stopReason: renderBlockingReason(result) })}\n`,
      stderr: "",
    };
  }

  return {
    exitCode: 0,
    stdout: `${JSON.stringify({ continue: true })}\n`,
    stderr: "",
  };
}
