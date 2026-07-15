import { isAbsolute } from "node:path";
import { realpath, stat } from "node:fs/promises";
import { runAudit } from "../audit/engine.js";
import type { AgentName } from "../types.js";
import { formatClaudeCodeHook } from "./claude-code.js";
import { formatCodexHook } from "./codex.js";
import { formatCursorHook } from "./cursor.js";
import { hookPayloadRoot, InvalidHookPayloadError, isHookReentry, type HookPayload } from "./payload.js";

export interface HookResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runGuardHook(payload: HookPayload): Promise<HookResponse> {
  const rootDir = await resolveHookRoot(payload);
  if (isHookReentry(payload)) {
    return continueHook(payload.agent);
  }

  const agent = payload.agent;
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

function continueHook(agent: AgentName): HookResponse {
  if (agent === "codex") {
    return { exitCode: 0, stdout: `${JSON.stringify({ continue: true })}\n`, stderr: "" };
  }

  if (agent === "cursor") {
    return { exitCode: 0, stdout: "{}\n", stderr: "" };
  }

  return { exitCode: 0, stdout: "", stderr: "" };
}

async function resolveHookRoot(payload: HookPayload): Promise<string> {
  const candidate = hookPayloadRoot(payload);
  if (!isAbsolute(candidate)) {
    throw new InvalidHookPayloadError(payload.agent);
  }

  try {
    const resolved = await realpath(candidate);
    const metadata = await stat(resolved);
    if (!metadata.isDirectory()) {
      throw new InvalidHookPayloadError(payload.agent);
    }

    return resolved;
  } catch (error) {
    if (error instanceof InvalidHookPayloadError) {
      throw error;
    }

    throw new InvalidHookPayloadError(payload.agent);
  }
}

export function unsupportedHookAgent(agent: string): HookResponse {
  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unsupported hook agent "${agent}". Supported agents: claude-code, codex, cursor.\n`,
  };
}
