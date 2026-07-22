import { defineCommand } from "citty";
import { runUpdate } from "../../install/orchestrator.js";

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Regenerate node-boost files from node-boost.json without prompts.",
  },
  async run() {
    const result = await runUpdate();
    const counts = result.operations.reduce(
      (summary, operation) => {
        summary[operation.status] += 1;
        return summary;
      },
      { created: 0, updated: 0, skipped: 0, deleted: 0, conflict: 0 },
    );

    console.log(`node-boost update: created ${counts.created}, updated ${counts.updated}, deleted ${counts.deleted}, conflicts ${counts.conflict}, skipped ${counts.skipped}`);
    process.exitCode = counts.conflict > 0 ? 1 : 0;
  },
});
