import { runAudit } from "../audit/engine.js";
import type { AgentName } from "../types.js";
import { formatClaudeCodeHook } from "./claude-code.js";
import { formatCodexHook } from "./codex.js";
import { formatCursorHook } from "./cursor.js";

export interface HookResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runGuardHook(agent: AgentName, rootDir = process.cwd()): Promise<HookResponse> {
  const result = await runAudit({ rootDir, mode: "changed" });

  if (agent === "claude-code") {
    return formatClaudeCodeHook(result);
  }

  if (agent === "codex") {
    return formatCodexHook(result);
  }

  if (agent === "cursor") {
    return formatCursorHook(result);
  }

  return unsupportedHookAgent(agent);
}

export function unsupportedHookAgent(agent: string): HookResponse {
  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unsupported hook agent "${agent}". Supported agents: claude-code, codex, cursor.\n`,
  };
}
