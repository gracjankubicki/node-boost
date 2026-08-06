import { execFile, spawn } from "node:child_process";
import { access, cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(join(tmpdir(), "node-boost-pack-smoke-"));
const checkoutRoot = join(tempRoot, "checkout");
const consumerRoot = join(tempRoot, "consumer");

try {
  await createSourceCheckout(checkoutRoot);
  await run("npm", ["ci"], checkoutRoot);
  await expectMissing(join(checkoutRoot, "dist"));

  const packOutput = await run("npm", ["pack", "--json", "--silent"], checkoutRoot);
  const jsonStart = packOutput.lastIndexOf("\n[");
  const packResult = JSON.parse(jsonStart === -1 ? packOutput : packOutput.slice(jsonStart + 1)) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  const packed = packResult[0];
  if (!packed) {
    throw new Error("npm pack did not return a package result.");
  }

  const requiredFiles = [
    "dist/cli.js",
    "dist/plugin.js",
    "dist/plugin.d.ts",
    "schema.json",
    "THIRD_PARTY_NOTICES.md",
    "resources/react/guidelines/core.md",
    "resources/react/skills/react-development/SKILL.md",
  ];
  const packedPaths = new Set(packed.files.map((file) => file.path));
  for (const path of requiredFiles) {
    if (!packedPaths.has(path)) {
      throw new Error(`Packed tarball is missing ${path}.`);
    }
  }
  if ([...packedPaths].some((path) => path.startsWith("tests/") || path.startsWith("implementation-plans/"))) {
    throw new Error("Packed tarball contains development-only files.");
  }

  const tarball = join(checkoutRoot, packed.filename);
  const extracted = join(tempRoot, "packed");
  await mkdir(extracted, { recursive: true });
  await run("tar", ["-xzf", tarball, "-C", extracted], tempRoot);
  const cliMode = (await stat(join(extracted, "package", "dist", "cli.js"))).mode;
  if ((cliMode & 0o111) === 0) {
    throw new Error("Packed CLI is not executable.");
  }
  const cliSourceMap = JSON.parse(
    await readFile(join(extracted, "package", "dist", "cli.js.map"), "utf8"),
  ) as { sources?: string[] };
  const bundledPackages = [...new Set(
    (cliSourceMap.sources ?? [])
      .map(packageNameFromNodeModulesSource)
      .filter((name): name is string => name !== null),
  )].sort((left, right) => left.localeCompare(right));
  const noticedPackages = [
    "@modelcontextprotocol/sdk",
    "ajv",
    "ajv-formats",
    "fast-deep-equal",
    "fast-uri",
    "json-schema-traverse",
    "zod-to-json-schema",
  ];
  if (JSON.stringify(bundledPackages) !== JSON.stringify(noticedPackages)) {
    throw new Error(`Bundled third-party package inventory differs from THIRD_PARTY_NOTICES.md: ${bundledPackages.join(", ")}.`);
  }
  const packedPackageJson = JSON.parse(
    await readFile(join(extracted, "package", "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  if (packedPackageJson.dependencies?.["@modelcontextprotocol/sdk"]) {
    throw new Error("Packed consumers must use the bundled MCP runtime instead of installing the full SDK tree.");
  }

  await mkdir(join(consumerRoot, "src"), { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ private: true, dependencies: { react: "^19.0.0" }, devDependencies: { vite: "^6.0.0", typescript: "^5.9.3" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(join(consumerRoot, "tsconfig.json"), '{ "compilerOptions": { "strict": true, "jsx": "react-jsx" } }\n', "utf8");
  await writeFile(join(consumerRoot, "src", "main.tsx"), "export const App = () => <main>packed consumer</main>;\n", "utf8");
  await run("npm", ["install", "--ignore-scripts", tarball], consumerRoot);
  await run("npm", ["audit", "--omit=dev", "--audit-level=low"], consumerRoot);

  const binary = join(consumerRoot, "node_modules", ".bin", "node-boost");
  const packedPluginApi = await import(
    pathToFileURL(join(consumerRoot, "node_modules", "@node-boost", "node-boost", "dist", "plugin.js")).href
  ) as Record<string, unknown>;
  if (JSON.stringify(Object.keys(packedPluginApi).sort()) !== JSON.stringify(["defineNodeBoostPlugin"])) {
    throw new Error("Packed plugin exports differ from the approved interface.");
  }
  await writeFile(
    join(consumerRoot, "contract.ts"),
    [
      'import { defineNodeBoostPlugin, type NodeBoostPluginDefinition } from "@node-boost/node-boost/plugin";',
      '// @ts-expect-error package root is intentionally not exported in 0.2.0',
      'import { runAudit } from "@node-boost/node-boost";',
      '// @ts-expect-error plugin subpath must not expose audit internals',
      'import { runAudit as leakedAudit } from "@node-boost/node-boost/plugin";',
      'const plugin: Readonly<NodeBoostPluginDefinition> = defineNodeBoostPlugin({',
      '  apiVersion: 1,',
      '  name: "@acme/node-boost-plugin",',
      '  architectures: [{',
      '    slug: "service-layer",',
      '    title: "Service layer",',
      '    stacks: ["vite-react"],',
      '    resources: { guideline: "resources/guideline.md", skill: "resources/SKILL.md" },',
      '  }],',
      '});',
      'void plugin;',
      'void runAudit;',
      'void leakedAudit;',
      '',
    ].join("\n"),
    "utf8",
  );
  await run(join(consumerRoot, "node_modules", ".bin", "tsc"), [
    "--noEmit",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--target",
    "ES2022",
    "contract.ts",
  ], consumerRoot);
  await run(binary, ["--help"], consumerRoot);
  await assertPackedMcpStarts(binary, consumerRoot);
  await run(binary, ["install", "--no-interaction"], consumerRoot);
  const doctorOutput = await run(binary, ["doctor", "--agent"], consumerRoot);
  const doctor = JSON.parse(doctorOutput) as { ok: boolean };
  if (!doctor.ok) {
    throw new Error("Packed consumer doctor did not pass.");
  }
  await access(join(consumerRoot, ".ai", "node-boost.schema.json"));

  process.stdout.write(`pack smoke passed: ${packed.filename}; ${requiredFiles.join(", ")}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function createSourceCheckout(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  if (process.env.CI === "true" || process.env.NODE_BOOST_PACK_SOURCE === "archive") {
    const archive = join(tempRoot, "source.tar");
    await run("git", ["archive", "HEAD", "-o", archive], repoRoot);
    await run("tar", ["-xf", archive, "-C", destination], tempRoot);
    return;
  }

  await cp(repoRoot, destination, {
    recursive: true,
    filter(source) {
      const name = source.slice(repoRoot.length + 1).split("/")[0];
      return ![".git", "node_modules", "dist", "coverage", "implementation-plans"].includes(name);
    },
  });
}

async function run(command: string, args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync(command, args, { cwd, maxBuffer: 20 * 1024 * 1024 });
  return result.stdout;
}

async function expectMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`${path} must not exist before npm pack.`);
}

async function assertPackedMcpStarts(binary: string, cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, ["mcp"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Packed MCP server did not initialize in time. stderr: ${stderr}`));
    }, 10_000);

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      const line = stdout.split("\n").find((candidate) => candidate.trim().length > 0);
      if (!line) {
        return;
      }
      try {
        const response = JSON.parse(line) as { id?: unknown; result?: { serverInfo?: { name?: string } } };
        if (response.id === 1 && response.result?.serverInfo?.name === "node-boost") {
          clearTimeout(timer);
          child.kill();
          resolve();
        }
      } catch {
        // Wait for a complete JSON line.
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code !== null && code !== 0 && !stdout.includes('"id":1')) {
        clearTimeout(timer);
        reject(new Error(`Packed MCP server exited with ${code}. stderr: ${stderr}`));
      }
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "node-boost-pack-smoke", version: "1.0.0" },
      },
    })}\n`);
  });
}

function packageNameFromNodeModulesSource(source: string): string | null {
  const marker = "node_modules/";
  const markerIndex = source.lastIndexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  const segments = source.slice(markerIndex + marker.length).split("/");
  return segments[0]?.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0] ?? null;
}
