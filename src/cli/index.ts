import { defineCommand, runMain } from "citty";
import { auditCommand } from "./commands/audit.js";
import { doctorCommand } from "./commands/doctor.js";
import { explainCommand } from "./commands/explain.js";
import { guardCommand } from "./commands/guard.js";
import { installCommand } from "./commands/install.js";
import { mcpCommand } from "./commands/mcp.js";
import { updateCommand } from "./commands/update.js";

const main = defineCommand({
  meta: {
    name: "node-boost",
    description: "CLI and MCP guidance layer for Node/React projects.",
  },
  subCommands: {
    audit: auditCommand,
    doctor: doctorCommand,
    explain: explainCommand,
    guard: guardCommand,
    install: installCommand,
    mcp: mcpCommand,
    update: updateCommand,
  },
});

await runMain(main);
