import type { AgentInstaller, AgentRenderContext, FileOperation } from "./agent.js";
import { formatMcpCommand } from "./agent.js";
import { mergeClaudeCodeHooks } from "./merge-hooks.js";
import { mergeMcpJson } from "./merge-json.js";
import { upsertManagedBlock } from "./managed-block.js";

export const claudeCodeAgent: AgentInstaller = {
  name: "claude-code",
  capabilities: {
    supportsGuidelines: true,
    supportsSkills: true,
    supportsMcp: true,
    supportsHooks: true,
  },
  render(context: AgentRenderContext): FileOperation[] {
    const body = [
      "# node-boost",
      "",
      `Use ${context.guidelinesIndexPath} as the generated guidance index.`,
      `Use ${context.libraryDocsPath} to navigate library documentation for detected versions; prefer its version-matched links over current-only upstream indexes.`,
      `Repo skills are available in ${context.skillsIndexPath} and mirrored to .claude/skills.`,
      `MCP command: ${formatMcpCommand(context.mcpCommand)}.`,
    ].join("\n");

    return [
      {
        path: "CLAUDE.md",
        content: upsertManagedBlock(context.existingContent("CLAUDE.md"), body),
      },
      {
        path: ".mcp.json",
        content: mergeMcpJson(context.existingContent(".mcp.json"), context.mcpCommand),
      },
      {
        path: ".claude/settings.json",
        content: mergeClaudeCodeHooks(context.existingContent(".claude/settings.json"), context.hookCommands["claude-code"]),
      },
      ...context.selectedSkills.map((skill) => ({
        path: skill.outputPath.replace(/^\.ai\/skills\//, ".claude/skills/"),
        content: context.skillContentByOutputPath.get(skill.outputPath) ?? "",
      })),
    ];
  },
};
