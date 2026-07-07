import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { detectPackageManager } from "./package-manager.js";
import { detectNextRouter } from "./router.js";
import type { DetectedStack, PackageInfo, StackName } from "../types.js";

const trackedPackages = [
  "next",
  "react",
  "vite",
  "react-router",
  "typescript",
  "tailwindcss",
  "zod",
  "@tanstack/react-query",
  "zustand",
  "vitest",
  "jest",
  "playwright",
] as const;

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export async function detectStack(rootDir: string): Promise<DetectedStack> {
  const packageJson = await readPackageJson(rootDir);
  const packageManager = await detectPackageManager(rootDir);
  const packages = await detectPackages(rootDir, packageJson);
  const warnings: string[] = [];

  const name = detectStackName(packages);
  const nextRouter = name === "next" ? await detectNextRouter(rootDir) : null;
  const router = nextRouter?.router ?? (name === "vite-react" ? "react-router" : "none");
  const srcDir = nextRouter?.srcDir ?? false;

  if (Object.values(packages).some((pkg) => pkg.source === "range")) {
    warnings.push("node_modules not available for at least one package; using declared version range fallback.");
  }

  return {
    rootDir,
    name,
    router,
    srcDir,
    packageManager,
    packages,
    warnings,
  };
}

async function detectPackages(rootDir: string, packageJson: PackageJson): Promise<Record<string, PackageInfo>> {
  const packages: Record<string, PackageInfo> = {};

  for (const packageName of trackedPackages) {
    const declaredRange = findDeclaredRange(packageJson, packageName);
    const installedVersion = await readInstalledVersion(rootDir, packageName);
    const version = installedVersion ?? extractVersionFromRange(declaredRange);

    packages[packageName] = {
      name: packageName,
      declaredRange,
      version,
      major: version ? parseMajor(version) : null,
      source: installedVersion ? "node_modules" : version ? "range" : "missing",
    };
  }

  return packages;
}

function detectStackName(packages: Record<string, PackageInfo>): StackName {
  if (packages.next?.version) {
    return "next";
  }

  if (packages.react?.version && packages.vite?.version && packages["react-router"]?.version) {
    return "vite-react";
  }

  if (packages.react?.version) {
    return "react-generic";
  }

  return "unknown";
}

async function readPackageJson(rootDir: string): Promise<PackageJson> {
  const raw = await readFile(join(rootDir, "package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error("package.json must contain an object.");
  }

  return parsed;
}

function findDeclaredRange(packageJson: PackageJson, packageName: string): string | null {
  return (
    packageJson.dependencies?.[packageName] ??
    packageJson.devDependencies?.[packageName] ??
    packageJson.peerDependencies?.[packageName] ??
    packageJson.optionalDependencies?.[packageName] ??
    null
  );
}

async function readInstalledVersion(rootDir: string, packageName: string): Promise<string | null> {
  try {
    const raw = await readFile(join(rootDir, "node_modules", packageName, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (isObject(parsed) && typeof parsed.version === "string") {
      return parsed.version;
    }

    return null;
  } catch {
    return null;
  }
}

export function extractVersionFromRange(range: string | null): string | null {
  if (!range) {
    return null;
  }

  const match = range.match(/\d+\.\d+\.\d+|\d+\.\d+|\d+/);

  if (!match) {
    return null;
  }

  const [major = "0", minor = "0", patch = "0"] = match[0].split(".");
  return `${major}.${minor}.${patch}`;
}

export function parseMajor(version: string): number | null {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
