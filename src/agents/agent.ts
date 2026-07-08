import type { Agent, AgentName, PackageManagerName, ResourceSelection } from "../types.js";

export interface McpCommand {
  command: string;
  args: string[];
}

export interface FileOperation {
  path: string;
  content: string;
}

export interface AgentRenderContext {
  guidelinesIndexPath: string;
  skillsIndexPath: string;
  selectedSkills: ResourceSelection[];
  existingContent: (path: string) => string | null;
  skillContentByOutputPath: Map<string, string>;
  mcpCommand: McpCommand;
}

export interface AgentInstaller extends Agent {
  render(context: AgentRenderContext): FileOperation[];
}

export function createMcpCommand(packageManager: PackageManagerName): McpCommand {
  if (packageManager === "yarn") {
    return { command: "yarn", args: ["node-boost", "mcp"] };
  }

  if (packageManager === "bun") {
    return { command: "bunx", args: ["node-boost", "mcp"] };
  }

  return { command: packageManager, args: ["exec", "node-boost", "mcp"] };
}

export function formatMcpCommand(command: McpCommand): string {
  return [command.command, ...command.args].join(" ");
}

export type AgentInstallerMap = Record<AgentName, AgentInstaller>;
