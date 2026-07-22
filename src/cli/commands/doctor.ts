import { defineCommand } from "citty";
import packageJson from "../../../package.json" with { type: "json" };
import { doctorTool, type DoctorCheck, type DoctorResult } from "../../mcp/tools/doctor.js";

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Check node-boost config, generated files, hooks, and project strictness.",
  },
  args: {
    agent: { type: "boolean", description: "Print machine-readable JSON.", default: false },
  },
  async run({ args }) {
    const result = await doctorTool(process.cwd(), packageJson.version);
    process.stdout.write(args.agent ? `${JSON.stringify(result)}\n` : renderDoctor(result));
    process.exitCode = result.ok ? 0 : 1;
  },
});

function renderDoctor(result: DoctorResult): string {
  return `${result.checks.map(renderCheck).join("\n")}\n`;
}

function renderCheck(check: DoctorCheck): string {
  const icon = check.status === "pass" ? "✔" : check.status === "warn" ? "⚠" : check.status === "skip" ? "−" : "✖";
  const details = check.details?.length ? `\n${check.details.map((detail) => `  - ${detail}`).join("\n")}` : "";
  return `${icon} ${check.id}: ${check.message}${details}`;
}
