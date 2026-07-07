import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "node-boost",
    description: "CLI and MCP guidance layer for Node/React projects.",
  },
  run() {
    console.log("node-boost foundation is installed. Commands will be added in later iterations.");
  },
});

await runMain(main);
