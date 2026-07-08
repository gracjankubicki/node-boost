import { defineCommand } from "citty";
import { startNodeBoostMcpServer } from "../../mcp/server.js";

export const mcpCommand = defineCommand({
  meta: {
    name: "mcp",
    description: "Start the node-boost MCP server over stdio.",
  },
  async run() {
    await startNodeBoostMcpServer();
  },
});
