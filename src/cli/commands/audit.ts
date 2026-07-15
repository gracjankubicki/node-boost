import { defineCommand } from "citty";
import { runAudit } from "../../audit/engine.js";
import { renderAgentReport } from "../../audit/reporters/agent.js";
import { renderHumanReport } from "../../audit/reporters/human.js";
import { auditOptionsFromArgs, auditScopeArgs } from "../audit-scope.js";
import { handleCliError } from "../errors.js";

export const auditCommand = defineCommand({
  meta: {
    name: "audit",
    description: "Audit the project against enabled node-boost architecture rules.",
  },
  args: {
    ...auditScopeArgs,
    agent: { type: "boolean", description: "Print compact machine-readable JSON.", default: false },
  },
  async run({ args }) {
    try {
      const result = await runAudit(auditOptionsFromArgs(args, "all"));

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
