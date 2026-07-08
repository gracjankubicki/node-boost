import type { AgentInstaller, AgentRenderContext, FileOperation } from "./agent.js";
import { formatMcpCommand } from "./agent.js";
import { mergeCursorHooks } from "./merge-hooks.js";
import { mergeMcpJson } from "./merge-json.js";

export const cursorAgent: AgentInstaller = {
  name: "cursor",
  capabilities: {
    supportsGuidelines: true,
    supportsSkills: true,
    supportsMcp: true,
    supportsHooks: true,
  },
  render(context: AgentRenderContext): FileOperation[] {
    return [
      {
        path: ".cursor/rules/node-boost.mdc",
        content: [
          "---",
          "alwaysApply: true",
          "---",
          "",
          "# node-boost",
          "",
          `Use ${context.guidelinesIndexPath} as the generated guidance index.`,
          `Skills are indexed in ${context.skillsIndexPath}.`,
          `MCP command: ${formatMcpCommand(context.mcpCommand)}.`,
          "",
        ].join("\n"),
      },
      {
        path: ".cursor/mcp.json",
        content: mergeMcpJson(context.existingContent(".cursor/mcp.json"), context.mcpCommand),
      },
      {
        path: ".cursor/hooks.json",
        content: mergeCursorHooks(context.existingContent(".cursor/hooks.json"), context.hookCommands.cursor),
      },
    ];
  },
};
