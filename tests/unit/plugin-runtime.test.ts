import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInstall, runUpdate } from "../../src/install/orchestrator.js";
import { applicationInfoTool } from "../../src/mcp/tools/application-info.js";
import { doctorTool } from "../../src/mcp/tools/doctor.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginName = "@acme/node-boost-plugin";
const architectureName = `${pluginName}:service-layer`;

describe("content-only plugin runtime", () => {
  it("installs, reports, converges, and safely removes plugin resources", async () => {
    await withConsumer(async (projectRoot) => {
      await writePlugin(projectRoot, { stacks: ["vite-react"] });
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await configurePlugin(projectRoot, { plugins: [pluginName], architectures: [{ name: architectureName, variant: "strict" }] });

      const first = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      const guidelinePath = ".ai/guidelines/architectures/plugins/@acme/node-boost-plugin/service-layer.md";
      const skillPath = ".ai/skills/plugins/@acme/node-boost-plugin/service-layer/SKILL.md";
      expect(first.operations).toContainEqual(expect.objectContaining({ path: guidelinePath, status: "created" }));
      await expect(readFile(join(projectRoot, guidelinePath), "utf8")).resolves.toContain("Strict service layer");
      await expect(readFile(join(projectRoot, skillPath), "utf8")).resolves.toContain("Service layer skill");
      await expect(
        readFile(join(projectRoot, ".agents/skills/plugins/@acme/node-boost-plugin/service-layer/SKILL.md"), "utf8"),
      ).resolves.toContain("Service layer skill");

      const second = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(second.operations.every((operation) => operation.status === "skipped")).toBe(true);

      const doctor = await doctorTool(projectRoot, "0.1.0");
      expect(doctor.checks).toContainEqual(expect.objectContaining({ id: "plugins-valid", status: "pass" }));
      const info = await applicationInfoTool(projectRoot, "0.1.0");
      expect(info.boost?.plugins).toEqual([{ name: pluginName, source: "dependency" }]);
      expect(info.boost?.architectures).toContainEqual(expect.objectContaining({ name: architectureName, source: pluginName }));

      await configurePlugin(projectRoot, { plugins: [], architectures: [] });
      const removed = await runUpdate({ cwd: projectRoot, packageRoot: repoRoot });
      expect(removed.operations).toContainEqual(expect.objectContaining({ path: guidelinePath, status: "deleted" }));
      expect(removed.operations).toContainEqual(expect.objectContaining({ path: skillPath, status: "deleted" }));
    });
  });

  it.each([
    ["stack mismatch", { stacks: ["next"] }, { plugins: [pluginName], architectures: [architectureName] }, "does not support stack"],
    ["missing resource", { stacks: ["vite-react"], guideline: "resources/missing.md" }, { plugins: [pluginName], architectures: [architectureName] }, "resource does not exist"],
    ["missing plugin", null, { plugins: [pluginName], architectures: [architectureName] }, "Cannot resolve node-boost plugin"],
  ])("fails atomically for %s", async (_label, plugin, config, message) => {
    await withConsumer(async (projectRoot) => {
      if (plugin) {
        await writePlugin(projectRoot, plugin);
      }
      await runInstall({ cwd: projectRoot, packageRoot: repoRoot, noInteraction: true });
      await configurePlugin(projectRoot, config);
      const before = await snapshotGenerated(projectRoot);

      await expect(runUpdate({ cwd: projectRoot, packageRoot: repoRoot })).rejects.toThrow(message);
      expect(await snapshotGenerated(projectRoot)).toEqual(before);
    });
  });
});

async function withConsumer(fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-plugin-consumer-"));
  try {
    await cp(join(repoRoot, "tests", "fixtures", "vite-app"), projectRoot, { recursive: true });
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function writePlugin(
  projectRoot: string,
  options: { stacks: string[]; guideline?: string },
): Promise<void> {
  const root = join(projectRoot, "node_modules", "@acme", "node-boost-plugin");
  await mkdir(join(root, "resources"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: pluginName, version: "1.0.0", type: "module", exports: "./index.js" }),
    "utf8",
  );
  await writeFile(
    join(root, "index.js"),
    `export default ${JSON.stringify({
      apiVersion: 1,
      name: pluginName,
      architectures: [{
        slug: "service-layer",
        title: "Service layer",
        stacks: options.stacks,
        resources: {
          guideline: options.guideline ?? "resources/guideline.md",
          skill: "resources/SKILL.md",
          variants: { strict: { guideline: "resources/strict.md" } },
        },
      }],
    })};\n`,
    "utf8",
  );
  await writeFile(join(root, "resources", "guideline.md"), "# Service layer\n", "utf8");
  await writeFile(join(root, "resources", "strict.md"), "# Strict service layer\n", "utf8");
  await writeFile(join(root, "resources", "SKILL.md"), "# Service layer skill\n", "utf8");
}

async function configurePlugin(
  projectRoot: string,
  update: { plugins: string[]; architectures: unknown[] },
): Promise<void> {
  const path = join(projectRoot, "node-boost.json");
  const config = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  config.plugins = update.plugins;
  config.architectures = update.architectures;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function snapshotGenerated(projectRoot: string): Promise<Record<string, string>> {
  const roots = [join(projectRoot, ".ai"), join(projectRoot, ".node-boost")];
  const files = (await Promise.all(roots.map(walk))).flat().sort((a, b) => a.localeCompare(b));
  return Object.fromEntries(await Promise.all(files.map(async (path) => [relative(projectRoot, path), await readFile(path, "utf8")] as const)));
}

async function walk(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
    }))).flat();
  } catch {
    return [];
  }
}
