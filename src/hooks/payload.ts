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

const toolInputSchema = z.object({ file_path: z.string().optional(), command: z.string().optional() });
const editPayloadSchema = z.object({
  session_id: z.string().min(1), cwd: z.string().min(1),
  hook_event_name: z.literal("PostToolUse"), tool_name: z.string().min(1),
  tool_input: toolInputSchema,
});
const cursorEditPayloadSchema = z.object({
  hook_event_name: z.literal("postToolUse"),
  cwd: z.string().min(1), tool_name: z.string().min(1), tool_input: toolInputSchema,
});

export type EditHookPayload = (z.infer<typeof editPayloadSchema> & { agent: "codex" | "claude-code" })
  | (z.infer<typeof cursorEditPayloadSchema> & { agent: "cursor" });

export type CodexHookPayload = z.infer<typeof codexPayloadSchema> & { agent: "codex" };
export type ClaudeCodeHookPayload = z.infer<typeof claudeCodePayloadSchema> & { agent: "claude-code" };
export type CursorHookPayload = z.infer<typeof cursorPayloadSchema> & { agent: "cursor" };
export type HookPayload = CodexHookPayload | ClaudeCodeHookPayload | CursorHookPayload | EditHookPayload;

export class InvalidHookPayloadError extends Error {
  constructor(agent: string) {
    super(`Invalid ${agent} hook payload. Expected valid JSON for a supported Stop or post-tool event.`);
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
  const event = typeof input === "object" && input !== null && "hook_event_name" in input ? input.hook_event_name : null;
  const result = (event === "PostToolUse" && agent !== "cursor" ? editPayloadSchema
    : event === "postToolUse" && agent === "cursor" ? cursorEditPayloadSchema : schema).safeParse(input);

  if (!result.success) {
    throw new InvalidHookPayloadError(agent);
  }

  return { ...result.data, agent } as HookPayload;
}

export function hookPayloadRoot(payload: HookPayload): string {
  return "cwd" in payload ? payload.cwd : payload.workspace_roots[0];
}

export function isHookReentry(payload: HookPayload): boolean {
  return ("stop_hook_active" in payload && payload.stop_hook_active)
    || ("loop_count" in payload && payload.loop_count > 0);
}
