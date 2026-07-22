import { z } from "zod";
import type { AgentName } from "../types.js";

const codexPayloadSchema = z.object({
  session_id: z.string().min(1),
  cwd: z.string().min(1),
  hook_event_name: z.literal("Stop"),
});

const claudeCodePayloadSchema = z.object({
  session_id: z.string().min(1),
  cwd: z.string().min(1),
  hook_event_name: z.literal("Stop"),
  stop_hook_active: z.boolean(),
});

const cursorPayloadSchema = z.object({
  hook_event_name: z.literal("stop"),
  workspace_roots: z.array(z.string().min(1)).min(1),
  loop_count: z.number().int().nonnegative(),
});

export type CodexHookPayload = z.infer<typeof codexPayloadSchema> & { agent: "codex" };
export type ClaudeCodeHookPayload = z.infer<typeof claudeCodePayloadSchema> & { agent: "claude-code" };
export type CursorHookPayload = z.infer<typeof cursorPayloadSchema> & { agent: "cursor" };
export type HookPayload = CodexHookPayload | ClaudeCodeHookPayload | CursorHookPayload;

export class InvalidHookPayloadError extends Error {
  constructor(agent: string) {
    super(`Invalid ${agent} hook payload. Expected valid JSON for the supported Stop event.`);
    this.name = "InvalidHookPayloadError";
  }
}

export function parseHookPayload(agent: AgentName, raw: string): HookPayload {
  let input: unknown;

  try {
    input = JSON.parse(raw);
  } catch {
    throw new InvalidHookPayloadError(agent);
  }

  const schema = agent === "codex"
    ? codexPayloadSchema
    : agent === "claude-code"
      ? claudeCodePayloadSchema
      : cursorPayloadSchema;
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new InvalidHookPayloadError(agent);
  }

  return { ...result.data, agent } as HookPayload;
}

export function hookPayloadRoot(payload: HookPayload): string {
  return payload.agent === "cursor" ? payload.workspace_roots[0] : payload.cwd;
}

export function isHookReentry(payload: HookPayload): boolean {
  return (payload.agent === "claude-code" && payload.stop_hook_active)
    || (payload.agent === "cursor" && payload.loop_count > 0);
}
