import { parse, stringify } from "smol-toml";
import type { McpCommand } from "./agent.js";

type TomlObject = Record<string, unknown>;

export function mergeCodexMcpToml(existingContent: string | null, command: McpCommand): string {
  const parsed = existingContent?.trim() ? parse(existingContent) : {};
  const root = isObject(parsed) ? parsed : {};
  const mcpServers = isObject(root.mcp_servers) ? root.mcp_servers : {};

  root.mcp_servers = {
    ...mcpServers,
    "node-boost": {
      command: command.command,
      args: command.args,
    },
  };

  return `${stringify(sortToml(root)).trim()}\n`;
}

export function removeCodexMcpToml(existingContent: string | null): string | null {
  if (existingContent === null) {
    return null;
  }

  const parsed = existingContent.trim() ? parse(existingContent) : {};
  const root = isObject(parsed) ? parsed : {};
  const mcpServers = isObject(root.mcp_servers) ? root.mcp_servers : {};
  if (!("node-boost" in mcpServers)) {
    return existingContent;
  }
  delete mcpServers["node-boost"];
  root.mcp_servers = mcpServers;
  return `${stringify(sortToml(root)).trim()}\n`;
}

function sortToml(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortToml);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortToml(item)]));
}

function isObject(value: unknown): value is TomlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
