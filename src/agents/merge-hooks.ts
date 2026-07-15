import type { McpCommand } from "./agent.js";

type JsonObject = Record<string, unknown>;

export function mergeClaudeCodeHooks(existingContent: string | null, command: McpCommand): string {
  const root = parseObject(existingContent);
  const hooks = asObject(root.hooks);
  const stop = asArray(hooks.Stop);

  hooks.Stop = appendCommandHook(stop, commandString(command), true);
  root.hooks = hooks;

  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
}

export function mergeCodexHooks(existingContent: string | null, command: McpCommand): string {
  const root = parseObject(existingContent);
  const hooks = asObject(root.hooks);
  const stop = asArray(hooks.Stop);

  hooks.Stop = appendCommandHook(stop, commandString(command), true);
  root.hooks = hooks;

  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
}

export function mergeCursorHooks(existingContent: string | null, command: McpCommand): string {
  const root = parseObject(existingContent);
  const hooks = asObject(root.hooks);
  const stop = asArray(hooks.stop);
  const commandValue = commandString(command);

  hooks.stop = stop.some((entry) => isObject(entry) && entry.command === commandValue)
    ? stop
    : [...stop, { command: commandValue }];
  root.version = typeof root.version === "number" ? root.version : 1;
  root.hooks = hooks;

  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
}

export function removeClaudeCodeHooks(existingContent: string | null): string | null {
  return removeGroupedHooks(existingContent, "Stop", "claude-code");
}

export function removeCodexHooks(existingContent: string | null): string | null {
  return removeGroupedHooks(existingContent, "Stop", "codex");
}

export function removeCursorHooks(existingContent: string | null): string | null {
  if (existingContent === null) {
    return null;
  }

  const root = parseObject(existingContent);
  const hooks = asObject(root.hooks);
  const stop = asArray(hooks.stop);
  if (!stop.some((entry) => isObject(entry) && isNodeBoostHookCommand(entry.command, "cursor"))) {
    return existingContent;
  }
  hooks.stop = stop.filter((entry) =>
    !isObject(entry) || !isNodeBoostHookCommand(entry.command, "cursor"),
  );
  root.hooks = hooks;
  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
}

function removeGroupedHooks(existingContent: string | null, event: string, agent: string): string | null {
  if (existingContent === null) {
    return null;
  }

  const root = parseObject(existingContent);
  const hooks = asObject(root.hooks);
  const entries = asArray(hooks[event]);
  if (!entries.some((entry) => isObject(entry) && Array.isArray(entry.hooks)
    && entry.hooks.some((hook) => isObject(hook) && isNodeBoostHookCommand(hook.command, agent)))) {
    return existingContent;
  }
  hooks[event] = entries.flatMap((entry) => {
    if (!isObject(entry) || !Array.isArray(entry.hooks)) {
      return [entry];
    }

    const remaining = entry.hooks.filter((hook) =>
      !isObject(hook) || !isNodeBoostHookCommand(hook.command, agent),
    );
    return remaining.length > 0 ? [{ ...entry, hooks: remaining }] : [];
  });
  root.hooks = hooks;
  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
}

function isNodeBoostHookCommand(value: unknown, agent: string): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const parts = value.split(" ").filter(Boolean);
  const executable = parts.indexOf("node-boost");
  return executable !== -1
    && parts[executable + 1] === "guard"
    && parts[executable + 2] === "--hook"
    && parts[executable + 3] === agent;
}

function appendCommandHook(entries: unknown[], command: string, includeType: boolean): unknown[] {
  if (entries.some((entry) => hookGroupHasCommand(entry, command))) {
    return entries;
  }

  const hook = includeType ? { type: "command", command, timeout: 30 } : { command };
  return [...entries, { hooks: [hook] }];
}

function hookGroupHasCommand(entry: unknown, command: string): boolean {
  return isObject(entry) && Array.isArray(entry.hooks) && entry.hooks.some((hook) => isObject(hook) && hook.command === command);
}

function commandString(command: McpCommand): string {
  return [command.command, ...command.args].join(" ");
}

function parseObject(content: string | null): JsonObject {
  const parsed: unknown = content?.trim() ? JSON.parse(content) : {};
  return isObject(parsed) ? parsed : {};
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortJson(item)]));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
