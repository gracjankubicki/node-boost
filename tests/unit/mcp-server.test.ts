import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, cp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeBoostMcpServer } from "../../src/mcp/server.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const servers: Array<{ close: () => Promise<void> }> = [];
const clients: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("node-boost MCP server", () => {
  it("returns application_info for Next and Vite fixtures", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await writeNodeBoostConfig(projectRoot, "0.1.0");
      const client = await createClient(projectRoot);
      const result = await callJsonTool<ApplicationInfo>(client, "application_info");

      expect(result.packageManager).toBe("npm@10.9.0");
      expect(result.typescript).toEqual({ version: "5.9.3", strict: true });
      expect(result.stack).toEqual({ name: "next", version: "16.2.9", router: "app", srcDir: true });
      expect(result.packages.react).toBe("19.2.7");
      expect(result.boost?.generatedWith).toBe("0.1.0");
      expect(result.boost?.architectures).toContainEqual({ name: "feature-modules", options: { boundary: "forbid" } });
    });

    await withFixture("vite-app", async (projectRoot) => {
      await writeNodeBoostConfig(projectRoot, "0.1.0");
      const client = await createClient(projectRoot);
      const result = await callJsonTool<ApplicationInfo>(client, "application_info");

      expect(result.packageManager).toBe("pnpm@10.0.0");
      expect(result.stack).toEqual({ name: "vite-react", version: "6.0.0", router: "react-router", srcDir: false });
      expect(result.packages["@tanstack/react-query"]).toBe("5.0.0");
      expect(result.boost?.architectures).toContainEqual({ name: "state-management", options: {} });
    });
  });

  it("lists Next routes and returns unsupported for Vite route maps", async () => {
    await withFixture("next-app", async (projectRoot) => {
      const client = await createClient(projectRoot);
      const routes = await callJsonTool<RouteEntry[]>(client, "list_routes");

      expect(routes).toContainEqual({
        path: "/invoices",
        type: "page",
        file: "src/app/invoices/page.tsx",
        dynamic: [],
      });
      expect(routes).toContainEqual({
        path: "/invoices/[id]",
        type: "page",
        file: "src/app/invoices/[id]/page.tsx",
        dynamic: ["id"],
      });
      expect(routes).toContainEqual({
        path: "/docs/[...slug]",
        type: "page",
        file: "src/app/docs/[...slug]/page.tsx",
        dynamic: ["slug"],
      });
      expect(routes).toContainEqual({
        path: "/about",
        type: "page",
        file: "src/app/(marketing)/about/page.tsx",
        dynamic: [],
      });
      expect(routes).toContainEqual({
        path: "/api/invoices",
        type: "route-handler",
        file: "src/app/api/invoices/route.ts",
        dynamic: [],
      });
      expect(routes).toContainEqual({
        path: "/invoices/[id]",
        type: "page",
        file: "src/app/@modal/invoices/[id]/page.tsx",
        dynamic: ["id"],
        slot: "modal",
      });
      expect(routes.map((route) => `${route.path}:${route.type}:${route.file}`)).toEqual(
        [...routes.map((route) => `${route.path}:${route.type}:${route.file}`)].sort((a, b) => a.localeCompare(b)),
      );
    });

    await withFixture("vite-app", async (projectRoot) => {
      const client = await createClient(projectRoot);
      const routes = await callJsonTool<UnsupportedRoutes>(client, "list_routes");

      expect(routes).toEqual({ supported: false, reason: "react-router route map is on the roadmap" });
    });
  });

  it("runs minimal doctor checks", async () => {
    await withFixture("next-app", async (projectRoot) => {
      const missingClient = await createClient(projectRoot);
      const missing = await callJsonTool<DoctorResult>(missingClient, "doctor");

      expect(missing.ok).toBe(false);
      expect(missing.checks).toContainEqual({
        id: "config-present",
        status: "fail",
        message: "node-boost.json is missing. Run node-boost install.",
      });

      await writeNodeBoostConfig(projectRoot, "0.0.1");
      const driftClient = await createClient(projectRoot);
      const drift = await callJsonTool<DoctorResult>(driftClient, "doctor");

      expect(drift.ok).toBe(true);
      expect(drift.checks).toContainEqual({
        id: "generated-with-drift",
        status: "warn",
        message: "generatedWith is 0.0.1, package is 0.1.0. Run node-boost update.",
      });

      await writeNodeBoostConfig(projectRoot, "0.1.0");
      const validClient = await createClient(projectRoot);
      const valid = await callJsonTool<DoctorResult>(validClient, "doctor");

      expect(valid.ok).toBe(true);
      expect(valid.checks).toContainEqual({
        id: "config-valid",
        status: "pass",
        message: "node-boost.json is valid.",
      });
    });
  });

  it("returns isError for a failing tool and keeps serving later calls", async () => {
    await withFixture("next-app", async (projectRoot) => {
      const client = await createClient(projectRoot, true);
      const failed = await client.callTool({ name: "__throw_for_test", arguments: {} });

      expect(failed.isError).toBe(true);
      expect(readText(failed)).toContain("NB-E500: forced test error");

      const doctor = await callJsonTool<DoctorResult>(client, "doctor");

      expect(doctor.checks.some((check) => check.id === "stack-detected")).toBe(true);
    });
  });
});

async function createClient(rootDir: string, includeThrowingTestTool = false): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createNodeBoostMcpServer({ rootDir, includeThrowingTestTool });
  const client = new Client({ name: "node-boost-test-client", version: "0.1.0" });

  servers.push(server);
  clients.push(client);

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function callJsonTool<T>(client: Client, name: string): Promise<T> {
  const result = await client.callTool({ name, arguments: {} });
  return JSON.parse(readText(result)) as T;
}

function readText(result: Awaited<ReturnType<Client["callTool"]>>): string {
  if (!hasContent(result)) {
    throw new Error("Expected tool result content.");
  }

  const first = result.content[0];

  if (!isTextContent(first)) {
    throw new Error("Expected text tool result.");
  }

  return first.text;
}

function hasContent(value: unknown): value is { content: unknown[] } {
  return typeof value === "object" && value !== null && "content" in value && Array.isArray(value.content);
}

function isTextContent(value: unknown): value is { type: "text"; text: string } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "text" && "text" in value && typeof value.text === "string";
}

async function withFixture(fixtureName: string, fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-mcp-"));

  try {
    await cp(join(repoRoot, "tests", "fixtures", fixtureName), projectRoot, { recursive: true });
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function writeNodeBoostConfig(projectRoot: string, generatedWith: string): Promise<void> {
  const packageJson = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const stack = packageJson.dependencies?.next ? "next" : "vite-react";

  await writeFile(
    join(projectRoot, "node-boost.json"),
    `${JSON.stringify(
      {
        version: 1,
        generatedWith,
        stack,
        agents: ["claude-code", "codex", "cursor"],
        features: { guidelines: true, skills: true, mcp: true, architecture: true, hooks: false },
        architectures: stack === "next" ? [{ name: "feature-modules", boundary: "forbid" }, "server-first-components"] : ["state-management"],
        audit: { exclude: [], rules: {}, ruleOptions: {} },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

interface ApplicationInfo {
  packageManager: string;
  typescript: { version: string | null; strict: boolean | null };
  stack: { name: string; version: string | null; router: string; srcDir: boolean };
  packages: Record<string, string>;
  boost: { generatedWith: string; architectures: Array<{ name: string; options: Record<string, unknown> }> } | null;
}

interface RouteEntry {
  path: string;
  type: string;
  file: string;
  dynamic: string[];
  slot?: string;
}

interface UnsupportedRoutes {
  supported: false;
  reason: string;
}

interface DoctorResult {
  ok: boolean;
  checks: Array<{ id: string; status: string; message: string }>;
}
