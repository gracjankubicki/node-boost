import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };
import { formatMcpError, debugLog } from "./errors.js";
import { applicationInfoTool } from "./tools/application-info.js";
import { auditTool } from "./tools/audit.js";
import { doctorTool } from "./tools/doctor.js";
import { explainFindingTool } from "./tools/explain-finding.js";
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
  registerJsonTool(server, "audit", "Run node-boost audit on all source files.", async () => auditTool(rootDir));
  registerJsonTool(
    server,
    "explain_finding",
    "Explain a node-boost audit finding. Pass {\"rule\":\"NB-ARCH-005\"}.",
    (args) => explainFindingTool(readRuleArg(args)),
    { rule: z.string() },
  );

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

function registerJsonTool(
  server: McpServer,
  name: string,
  description: string,
  handler: (args: Record<string, unknown>) => ToolOutput | Promise<ToolOutput>,
  inputSchema: Record<string, z.ZodTypeAny> = {},
): void {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema,
    },
    async (args: Record<string, unknown>) => {
      const start = performance.now();

      try {
        const output = await handler(args);
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

function readRuleArg(args: Record<string, unknown>): string {
  return typeof args.rule === "string" ? args.rule : "";
}
