import { defineCommand, runMain } from "citty";
import { installCommand } from "./commands/install.js";
import { updateCommand } from "./commands/update.js";

const main = defineCommand({
  meta: {
    name: "node-boost",
    description: "CLI and MCP guidance layer for Node/React projects.",
  },
  subCommands: {
    install: installCommand,
    update: updateCommand,
  },
});

await runMain(main);
