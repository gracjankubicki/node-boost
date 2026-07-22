import { execFile } from "node:child_process";
import { access, cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(tmpdir(), "node-boost-plugin-smoke-"));
const checkoutRoot = join(tempRoot, "checkout");
const consumerRoot = join(tempRoot, "consumer");
const pluginName = "@node-boost-example/service-layer-plugin";
const architectureName = `${pluginName}:service-layer`;
const guidelinePath = ".ai/guidelines/architectures/plugins/@node-boost-example/service-layer-plugin/service-layer.md";
const skillPath = ".ai/skills/plugins/@node-boost-example/service-layer-plugin/service-layer/SKILL.md";

try {
  await createSourceCheckout(checkoutRoot);
  await run("npm", ["ci"], checkoutRoot);
  const nodeBoostTarball = await pack(checkoutRoot);
  const pluginRoot = join(checkoutRoot, "examples", "service-layer-plugin");
  const pluginManifest = JSON.parse(await readFile(join(pluginRoot, "node-boost.plugin.json"), "utf8")) as {
    apiVersion?: unknown;
    name?: unknown;
  };
  if (pluginManifest.apiVersion !== 1 || pluginManifest.name !== pluginName) {
    throw new Error("Example plugin must provide the versioned static node-boost.plugin.json manifest.");
  }
  const pluginTarball = await pack(pluginRoot);

  await mkdir(join(consumerRoot, "src"), { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ private: true, dependencies: { react: "^19.0.0" }, devDependencies: { vite: "^6.0.0", typescript: "^5.9.3" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(join(consumerRoot, "tsconfig.json"), '{ "compilerOptions": { "strict": true, "jsx": "react-jsx" } }\n', "utf8");
  await writeFile(join(consumerRoot, "src", "main.tsx"), "export const App = () => <main>plugin smoke</main>;\n", "utf8");
  await run("npm", ["install", "--ignore-scripts", "--no-package-lock", nodeBoostTarball, pluginTarball], consumerRoot);

  const binary = join(consumerRoot, "node_modules", ".bin", "node-boost");
  await run(binary, ["install", "--no-interaction"], consumerRoot);
  await updateConfig(consumerRoot, {
    plugins: [pluginName],
    architectures: [{ name: architectureName, variant: "strict" }],
  });
  await run(binary, ["update"], consumerRoot);
  await expectContent(join(consumerRoot, guidelinePath), "Service layer (strict)");
  await expectContent(join(consumerRoot, skillPath), "Service layer");
  await expectContent(join(consumerRoot, ".agents/skills/plugins/@node-boost-example/service-layer-plugin/service-layer/SKILL.md"), "Service layer");
  await expectContent(join(consumerRoot, ".ai/guidelines/node-boost.md"), `plugin ${pluginName}`);

  const firstTree = await snapshotGenerated(consumerRoot);
  await run(binary, ["update"], consumerRoot);
  const secondTree = await snapshotGenerated(consumerRoot);
  if (JSON.stringify(firstTree) !== JSON.stringify(secondTree)) {
    throw new Error("Second plugin update changed generated output.");
  }
  const doctor = JSON.parse(await run(binary, ["doctor", "--agent"], consumerRoot)) as {
    ok: boolean;
    checks: Array<{ id: string; status: string }>;
  };
  if (!doctor.ok || !doctor.checks.some((check) => check.id === "plugins-valid" && check.status === "pass")) {
    throw new Error("Packed plugin consumer doctor did not validate the configured plugin.");
  }

  await updateConfig(consumerRoot, { plugins: [], architectures: [] });
  await run(binary, ["update"], consumerRoot);
  await expectMissing(join(consumerRoot, guidelinePath));
  await expectMissing(join(consumerRoot, skillPath));
  const afterRemoval = JSON.parse(await run(binary, ["doctor", "--agent"], consumerRoot)) as { ok: boolean };
  if (!afterRemoval.ok) {
    throw new Error("Doctor failed after removing the plugin configuration.");
  }

  process.stdout.write(`plugin pack smoke passed: ${relative(tempRoot, nodeBoostTarball)} + ${relative(tempRoot, pluginTarball)}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function createSourceCheckout(destination: string): Promise<void> {
  await cp(repoRoot, destination, {
    recursive: true,
    filter(source) {
      const name = source.slice(repoRoot.length + 1).split("/")[0];
      return ![".git", "node_modules", "dist", "coverage", "implementation-plans"].includes(name);
    },
  });
}

async function pack(cwd: string): Promise<string> {
  const output = await run("npm", ["pack", "--json", "--silent"], cwd);
  const jsonStart = output.lastIndexOf("\n[");
  const result = JSON.parse(jsonStart === -1 ? output : output.slice(jsonStart + 1)) as Array<{ filename: string }>;
  const filename = result[0]?.filename;
  if (!filename) {
    throw new Error(`npm pack returned no tarball for ${cwd}.`);
  }
  return join(cwd, filename);
}

async function updateConfig(
  root: string,
  update: { plugins: string[]; architectures: unknown[] },
): Promise<void> {
  const path = join(root, "node-boost.json");
  const config = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  config.plugins = update.plugins;
  config.architectures = update.architectures;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function snapshotGenerated(root: string): Promise<Record<string, string>> {
  const files = (await Promise.all([walk(join(root, ".ai")), walk(join(root, ".agents")), walk(join(root, ".node-boost"))]))
    .flat()
    .sort((left, right) => left.localeCompare(right));
  return Object.fromEntries(await Promise.all(files.map(async (path) => [relative(root, path), await readFile(path, "utf8")] as const)));
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

async function expectContent(path: string, expected: string): Promise<void> {
  const content = await readFile(path, "utf8");
  if (!content.includes(expected)) {
    throw new Error(`${path} does not contain expected content: ${expected}.`);
  }
}

async function expectMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`${path} should have been removed.`);
}

async function run(command: string, args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync(command, args, { cwd, maxBuffer: 20 * 1024 * 1024 });
  return result.stdout;
}
