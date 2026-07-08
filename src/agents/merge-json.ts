import type { McpCommand } from "./agent.js";

type JsonObject = Record<string, unknown>;

export function mergeMcpJson(existingContent: string | null, command: McpCommand): string {
  const parsed: unknown = existingContent?.trim() ? JSON.parse(existingContent) : {};
  const root = isObject(parsed) ? parsed : {};
  const mcpServers = isObject(root.mcpServers) ? root.mcpServers : {};

  root.mcpServers = {
    ...mcpServers,
    "node-boost": {
      command: command.command,
      args: command.args,
    },
  };

  return `${JSON.stringify(sortJson(root), null, 2)}\n`;
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
