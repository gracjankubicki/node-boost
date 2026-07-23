import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtemp, cp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeBoostMcpServer } from "../../src/mcp/server.js";
import { runInstall } from "../../src/install/orchestrator.js";

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
      expect(result.capabilities).toEqual({ reactCompiler: false, nextCacheComponents: false });
      expect(result.packages.react).toBe("19.2.7");
      expect(result.boost?.generatedWith).toBe("0.1.0");
      expect(result.boost?.architectures).toContainEqual(expect.objectContaining({
        name: "feature-modules",
        options: { boundary: "forbid" },
        source: "built-in",
      }));
    });

    await withFixture("vite-app", async (projectRoot) => {
      await writeNodeBoostConfig(projectRoot, "0.1.0");
      const client = await createClient(projectRoot);
      const result = await callJsonTool<ApplicationInfo>(client, "application_info");

      expect(result.packageManager).toBe("pnpm@10.0.0");
      expect(result.stack).toEqual({ name: "vite-react", version: "6.0.0", router: "react-router", srcDir: false });
      expect(result.packages["@tanstack/react-query"]).toBe("5.0.0");
      expect(result.boost?.architectures).toContainEqual({ name: "state-management", options: {}, source: "built-in" });
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

  it("returns version-aware library documentation routes", async () => {
    await withFixture("next-app", async (projectRoot) => {
      const client = await createClient(projectRoot);
      const result = await callJsonTool<LibraryDocsResult>(client, "library_docs");
      const next = result.packages.find((entry) => entry.packageName === "next");
      const zod = result.packages.find((entry) => entry.packageName === "zod");

      expect(result.indexPath).toBe(".ai/docs/llms.txt");
      expect(next).toMatchObject({
        version: "16.2.9",
        preferredUrl: "https://www.npmjs.com/package/next/v/16.2.9",
        preferredScope: "package",
        versionSource: "declared-range",
      });
      expect(zod).toMatchObject({
        version: "4.0.0",
        preferredUrl: "https://zod.dev/llms.txt",
        preferredScope: "major",
      });
    });
  });

  it("runs full doctor checks", async () => {
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

      expect(drift.ok).toBe(false);
      expect(drift.checks).toContainEqual({
        id: "generated-with-drift",
        status: "fail",
          message: "generatedWith is 0.0.1, package is 0.4.0. Run node-boost update.",
      });
      expect(drift.checks).toContainEqual(expect.objectContaining({ id: "agent-files-present", status: "fail" }));

      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const validClient = await createClient(projectRoot);
      const valid = await callJsonTool<DoctorResult>(validClient, "doctor");

      expect(valid.ok).toBe(true);
      expect(valid.checks).toContainEqual({
        id: "config-valid",
        status: "pass",
        message: "node-boost.json is valid.",
      });

      await writeFile(join(projectRoot, ".ai", "guidelines", "core.md"), "# edited\n", "utf8");
      const staleClient = await createClient(projectRoot);
      const stale = await callJsonTool<DoctorResult>(staleClient, "doctor");

      expect(stale.ok).toBe(false);
      expect(stale.checks).toContainEqual(expect.objectContaining({ id: "resources-fresh", status: "fail" }));
    });
  });

  it("reports doctor failures and warnings for invalid config, hooks, overrides, and strict mode", async () => {
    await withFixture("next-app", async (projectRoot) => {
      await writeFile(join(projectRoot, "node-boost.json"), JSON.stringify({ version: 2, stack: "next" }), "utf8");
      const client = await createClient(projectRoot);
      const invalid = await callJsonTool<DoctorResult>(client, "doctor");

      expect(invalid.ok).toBe(false);
      expect(invalid.checks).toContainEqual(expect.objectContaining({ id: "config-valid", status: "fail" }));
    });

    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      const config = JSON.parse(await readFile(join(projectRoot, "node-boost.json"), "utf8")) as {
        features: { hooks: boolean };
      };
      config.features.hooks = true;
      await writeFile(join(projectRoot, "node-boost.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");

      const client = await createClient(projectRoot);
      const hooks = await callJsonTool<DoctorResult>(client, "doctor");

      expect(hooks.ok).toBe(false);
      expect(hooks.checks).toContainEqual(expect.objectContaining({ id: "hooks-wired", status: "fail" }));
    });

    await withFixture("next-app", async (projectRoot) => {
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await mkdir(join(projectRoot, ".node-boost", "guidelines"), { recursive: true });
      await writeFile(join(projectRoot, ".node-boost", "guidelines", "core.md"), "# override\n", "utf8");

      const client = await createClient(projectRoot);
      const overrides = await callJsonTool<DoctorResult>(client, "doctor");

      expect(overrides.checks).toContainEqual(expect.objectContaining({ id: "overrides-detected", status: "pass" }));
      expect(overrides.checks.find((check) => check.id === "overrides-detected")?.details).toContain("guidelines/core.md");
    });

    await withFixture("dirty-next-app", async (projectRoot) => {
      const client = await createClient(projectRoot);
      const strict = await callJsonTool<DoctorResult>(client, "doctor");

      expect(strict.checks).toContainEqual(expect.objectContaining({ id: "lint-strict", status: "warn" }));
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

  it("exposes audit and explain_finding tools", async () => {
    await withFixture("dirty-next-app", async (projectRoot) => {
      const client = await createClient(projectRoot);
      const audit = await callJsonTool<{ ok: boolean; findings: Array<{ rule: string }> }>(client, "audit");

      expect(audit.ok).toBe(false);
      expect(audit.findings).toContainEqual(expect.objectContaining({ rule: "NB-ARCH-005" }));

      const explained = await client.callTool({ name: "explain_finding", arguments: { rule: "NB-ARCH-005" } });
      const parsed = JSON.parse(readText(explained)) as { ok: boolean; finding: { rule: string; guideline: string } };

      expect(parsed.ok).toBe(true);
      expect(parsed.finding.rule).toBe("NB-ARCH-005");
      expect(parsed.finding.guideline).toContain("data-access-layer");
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
  capabilities: { reactCompiler: boolean; nextCacheComponents: boolean };
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

interface LibraryDocsResult {
  indexPath: string;
  packages: Array<{
    packageName: string;
    version: string;
    preferredUrl: string;
    preferredScope: string;
    versionSource: string;
  }>;
}

interface DoctorResult {
  ok: boolean;
  checks: Array<{ id: string; status: string; message: string; details?: string[] }>;
}
