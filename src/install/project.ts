import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageJson {
  name?: string;
  version?: string;
  workspaces?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export async function findNearestPackageRoot(cwd: string): Promise<string | null> {
  let current = cwd;

  while (true) {
    if (await pathExists(join(current, "package.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export async function readPackageJson(rootDir: string): Promise<PackageJson> {
  const raw = await readFile(join(rootDir, "package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error("package.json must contain an object.");
  }

  return parsed;
}

export async function isWorkspaceRoot(rootDir: string): Promise<boolean> {
  const packageJson = await readPackageJson(rootDir);
  return Boolean(packageJson.workspaces) || (await pathExists(join(rootDir, "pnpm-workspace.yaml")));
}

export async function resolveDefaultPackageRoot(importMetaUrl: string): Promise<string> {
  let current = dirname(fileURLToPath(importMetaUrl));

  while (true) {
    if (await pathExists(join(current, "resources", "react"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
