import type { AgentInstaller, AgentRenderContext, FileOperation } from "./agent.js";
import { formatMcpCommand } from "./agent.js";
import { mergeCodexHooks } from "./merge-hooks.js";
import { mergeCodexMcpToml } from "./merge-toml.js";
import { upsertManagedBlock } from "./managed-block.js";

export const codexAgent: AgentInstaller = {
  name: "codex",
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
      `Repo skills are installed in .agents/skills and source skills are indexed in ${context.skillsIndexPath}.`,
      `MCP command: ${formatMcpCommand(context.mcpCommand)}.`,
    ].join("\n");

    return [
      {
        path: "AGENTS.md",
        content: upsertManagedBlock(context.existingContent("AGENTS.md"), body),
      },
      {
        path: ".codex/config.toml",
        content: mergeCodexMcpToml(context.existingContent(".codex/config.toml"), context.mcpCommand),
      },
      {
        path: ".codex/hooks.json",
        content: mergeCodexHooks(context.existingContent(".codex/hooks.json"), context.hookCommands.codex),
      },
      ...context.selectedSkills.map((skill) => ({
        path: skill.outputPath.replace(/^\.ai\/skills\//, ".agents/skills/"),
        content: context.skillContentByOutputPath.get(skill.outputPath) ?? "",
      })),
    ];
  },
};
