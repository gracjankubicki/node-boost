import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };
import { formatMcpError, debugLog } from "./errors.js";
import { applicationInfoTool } from "./tools/application-info.js";
import { doctorTool } from "./tools/doctor.js";
import { listRoutesTool } from "./tools/list-routes.js";

type ToolOutput = object | unknown[];

export interface NodeBoostMcpServerOptions {
  rootDir?: string;
  packageVersion?: string;
  includeThrowingTestTool?: boolean;
}

export function createNodeBoostMcpServer(options: NodeBoostMcpServerOptions = {}): McpServer {
  const rootDir = options.rootDir ?? process.cwd();
  const packageVersion = options.packageVersion ?? packageJson.version;
  const server = new McpServer({
    name: "node-boost",
    version: packageVersion,
  });

  registerJsonTool(server, "application_info", "Return detected Node/React project information.", async () =>
    applicationInfoTool(rootDir, packageVersion),
  );
  registerJsonTool(server, "list_routes", "List detected application routes.", async () => listRoutesTool(rootDir));
  registerJsonTool(server, "doctor", "Run minimal node-boost project diagnostics.", async () => doctorTool(rootDir, packageVersion));

  if (options.includeThrowingTestTool) {
    registerJsonTool(server, "__throw_for_test", "Internal test-only failing tool.", () => {
      throw new Error("forced test error");
    });
  }

  return server;
}

export async function startNodeBoostMcpServer(options: NodeBoostMcpServerOptions = {}): Promise<void> {
  const server = createNodeBoostMcpServer(options);
  await server.connect(new StdioServerTransport());
}

function registerJsonTool(server: McpServer, name: string, description: string, handler: () => ToolOutput | Promise<ToolOutput>): void {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema: z.object({}),
    },
    async () => {
      const start = performance.now();

      try {
        const output = await handler();
        debugLog(`[node-boost:mcp] ${name} ok ${Math.round(performance.now() - start)}ms`);
        return {
          content: [{ type: "text", text: JSON.stringify(output) }],
        };
      } catch (error) {
        const message = formatMcpError(error);
        debugLog(`[node-boost:mcp] ${name} err ${Math.round(performance.now() - start)}ms ${message}`);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
