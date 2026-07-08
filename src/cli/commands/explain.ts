import { defineCommand } from "citty";
import { explainFinding } from "../../audit/registry.js";

export const explainCommand = defineCommand({
  meta: {
    name: "explain",
    description: "Explain a node-boost audit finding.",
  },
  args: {
    agent: { type: "boolean", description: "Print machine-readable JSON.", default: false },
  },
  run({ args }) {
    const ruleId = Array.isArray(args._) ? String(args._[0] ?? "") : "";
    const entry = explainFinding(ruleId);

    if (!entry) {
      const message = `Unknown node-boost rule "${ruleId}".\n`;
      if (args.agent) {
        process.stdout.write(`${JSON.stringify({ ok: false, error: message.trim() })}\n`);
      } else {
        process.stderr.write(message);
      }
      process.exitCode = 1;
      return;
    }

    if (args.agent) {
      process.stdout.write(`${JSON.stringify({ ok: true, finding: entry })}\n`);
      return;
    }

    process.stdout.write([
      `${entry.rule} ${entry.code}`,
      `Severity: ${entry.severity}`,
      `Architecture: ${entry.architecture}`,
      entry.description,
      entry.rationale,
      `Fix: ${entry.fix}`,
      `Guideline: ${entry.guideline}`,
      "",
    ].join("\n"));
  },
});
