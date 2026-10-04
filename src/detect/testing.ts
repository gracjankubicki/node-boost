import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface NodeTestCapability {
  runtime: string | null;
  runtimeSource: "project" | "process";
  runtimeDeclaration: string | null;
  runnerSupported: boolean | null;
  nativeTypeScript: boolean | null;
  typeStrippingDisabled: boolean;
}

// https://nodejs.org/api/typescript.html: default stripping 22.18 / 23.6;
// explicit --experimental-strip-types available from 22.6. Runner: Node 18.
export async function detectTesting(root: string, packages: Record<string, { version: string | null } | undefined>): Promise<{
  testTools: string[];
  nodeTest: NodeTestCapability | null;
}> {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>; engines?: { node?: string };
  };
  const testTools = ["vitest", "jest", "playwright", "@playwright/test", "cypress", "storybook", "@storybook/react"]
    .filter((name) => Boolean(packages[name]?.version));
  const scripts = Object.values(pkg.scripts ?? {}).filter((script) => /(?:^|&&\s*|;\s*)node\s[^;&|]*--test(?:\s|$|=)/.test(script));
  if (!scripts.length) return { testTools, nodeTest: null };
  let declared: string | undefined;
  for (const path of [".nvmrc", ".node-version"]) {
    try { declared = (await readFile(join(root, path), "utf8")).trim(); break; } catch { /* optional */ }
  }
  declared ??= pkg.engines?.node;
  const version = declared?.match(/(?:^|>=\s*|\^|~|v)(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (declared !== undefined && !version) {
    const typeStrippingDisabled = scripts.some((script) => /--no-(?:experimental-)?strip-types\b/.test(script));
    return { testTools, nodeTest: { runtime: null, runtimeSource: "project", runtimeDeclaration: declared,
      runnerSupported: null, nativeTypeScript: typeStrippingDisabled ? false : null, typeStrippingDisabled } };
  }
  const runtime = version ? [version[1], version[2] ?? "0", version[3] ?? "0"].join(".") : process.versions.node;
  const [major, minor] = runtime.split(".").map(Number) as [number, number];
  const defaultStripping = major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
  const explicitStripping = scripts.every((script) => /--experimental-strip-types\b/.test(script)) && (major > 22 || (major === 22 && minor >= 6));
  const typeStrippingDisabled = scripts.some((script) => /--no-(?:experimental-)?strip-types\b/.test(script));
  const nodeTest = { runtime, runtimeSource: version ? "project" as const : "process" as const,
    runtimeDeclaration: declared ?? null, runnerSupported: major >= 18,
    nativeTypeScript: !typeStrippingDisabled && (defaultStripping || explicitStripping), typeStrippingDisabled };
  if (major >= 18) testTools.push("node:test");
  return { testTools, nodeTest };
}

export function isTestFile(path: string): boolean {
  return /(?:^|\/)(?:__tests__|tests?|e2e)\//.test(path)
    || /(?:^|\/)(?:test[-.][^/]+|[^/]+\.(?:test|spec))\.(?:[cm]?[jt]sx?|astro)$/.test(path);
}
