import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageManagerInfo, PackageManagerName } from "../types.js";

const lockfiles: Array<{ name: PackageManagerName; file: string }> = [
  { name: "pnpm", file: "pnpm-lock.yaml" },
  { name: "yarn", file: "yarn.lock" },
  { name: "bun", file: "bun.lockb" },
  { name: "bun", file: "bun.lock" },
  { name: "npm", file: "package-lock.json" },
];

export async function detectPackageManager(rootDir: string): Promise<PackageManagerInfo> {
  for (const lockfile of lockfiles) {
    if (await fileExists(join(rootDir, lockfile.file))) {
      return { name: lockfile.name, lockfile: lockfile.file, source: "lockfile" };
    }
  }

  const packageJson = await readJsonObject(join(rootDir, "package.json"));
  const packageManager = typeof packageJson?.packageManager === "string" ? packageJson.packageManager : null;
  const managerName = packageManager?.split("@")[0];

  if (isPackageManagerName(managerName)) {
    return { name: managerName, lockfile: null, source: "packageManagerField" };
  }

  return { name: "npm", lockfile: null, source: "default" };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonObject(path: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPackageManagerName(value: string | undefined): value is PackageManagerName {
  return value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
