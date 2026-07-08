import { defineCommand } from "citty";
import { runAudit } from "../../audit/engine.js";
import { renderAgentReport } from "../../audit/reporters/agent.js";
import { renderHumanReport } from "../../audit/reporters/human.js";
import { handleCliError } from "../errors.js";

export const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Audit the project against enabled node-boost architecture rules.",
  },
  args: {
    all: { type: "boolean", description: "Audit all source files.", default: false },
    changed: { type: "boolean", description: "Audit changed and untracked source files.", default: false },
    base: { type: "string", description: "Audit files changed since merge-base with this ref.", required: false },
    agent: { type: "boolean", description: "Print compact machine-readable JSON.", default: false },
  },
  async run({ args }) {
    try {
      const paths = Array.isArray(args._) ? args._.map(String) : [];
      const result = await runAudit({
        mode: paths.length > 0 ? "paths" : args.base ? "base" : args.changed ? "changed" : "all",
        base: args.base,
        paths,
      });

      process.stdout.write(args.agent ? renderAgentReport(result) : renderHumanReport(result));
      process.exitCode = result.err > 0 ? 1 : 0;
    } catch (error) {
      if (handleCliError(error)) {
        return;
      }

      throw error;
    }
  },
});
