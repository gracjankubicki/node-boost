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
  hookCommands: Record<AgentName, McpCommand>;
}

export interface AgentInstaller extends Agent {
  render(context: AgentRenderContext): FileOperation[];
}

export function createMcpCommand(packageManager: PackageManagerName): McpCommand {
  return createPackageCommand(packageManager, ["mcp"]);
}

export function createHookCommand(packageManager: PackageManagerName, agent: AgentName): McpCommand {
  return createPackageCommand(packageManager, ["guard", "--hook", agent]);
}

export function createPackageCommand(packageManager: PackageManagerName, nodeBoostArgs: string[]): McpCommand {
  if (packageManager === "npm") {
    return { command: "npm", args: ["exec", "--", "node-boost", ...nodeBoostArgs] };
  }

  if (packageManager === "yarn") {
    return { command: "yarn", args: ["node-boost", ...nodeBoostArgs] };
  }

  if (packageManager === "bun") {
    return { command: "bunx", args: ["node-boost", ...nodeBoostArgs] };
  }

  return { command: packageManager, args: ["exec", "node-boost", ...nodeBoostArgs] };
}

export function formatMcpCommand(command: McpCommand): string {
  return [command.command, ...command.args].join(" ");
}

export type AgentInstallerMap = Record<AgentName, AgentInstaller>;
