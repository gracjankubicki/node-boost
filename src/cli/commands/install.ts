import { defineCommand } from "citty";
import { runInstall } from "../../install/orchestrator.js";

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Generate node-boost guidelines, skills, config, and agent files.",
  },
  args: {
    interaction: {
      type: "boolean",
      description: "Prompt before writing files. Use --no-interaction for detected defaults.",
      default: true,
    },
  },
  async run({ args }) {
    const result = await runInstall({ noInteraction: args.interaction === false });
    const counts = countStatuses(result.operations);

    console.log(`node-boost install: created ${counts.created}, updated ${counts.updated}, skipped ${counts.skipped}`);
  },
});

function countStatuses(operations: Awaited<ReturnType<typeof runInstall>>["operations"]): Record<"created" | "updated" | "skipped", number> {
  return operations.reduce(
    (summary, operation) => {
      summary[operation.status] += 1;
      return summary;
    },
    { created: 0, updated: 0, skipped: 0 },
  );
}
