import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const generatedManifestPath = ".node-boost/generated-manifest.json";

export interface GeneratedFileRecord {
  path: string;
  sha256: string;
}

export interface GeneratedManifest {
  version: 1;
  generatedWith: string;
  files: GeneratedFileRecord[];
}

export interface GeneratedOwnershipInspection {
  stale: string[];
  modified: string[];
  outdated: string[];
}

export function hashGeneratedContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function isOwnedGeneratedPath(path: string): boolean {
  const normalized = normalizeGeneratedPath(path);
  return normalized.startsWith(".ai/")
    || normalized.startsWith(".agents/skills/")
    || normalized.startsWith(".claude/skills/")
    || normalized === ".cursor/rules/node-boost.mdc";
}

export async function readGeneratedManifest(projectRoot: string): Promise<GeneratedManifest | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(projectRoot, generatedManifestPath), "utf8"));
    return isGeneratedManifest(parsed)
      ? { ...parsed, files: parsed.files.map((file) => ({ ...file, path: normalizeGeneratedPath(file.path) })) }
      : null;
  } catch {
    return null;
  }
}

export function renderGeneratedManifest(generatedWith: string, files: Iterable<GeneratedFileRecord>): string {
  const manifest: GeneratedManifest = {
    version: 1,
    generatedWith,
    files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function inspectGeneratedOwnership(
  projectRoot: string,
  expectedOperations: Array<{ path: string; content: string }>,
): Promise<GeneratedOwnershipInspection> {
  const manifest = await readGeneratedManifest(projectRoot);
  const expected = new Map(
    expectedOperations.filter((operation) => isOwnedGeneratedPath(operation.path)).map((operation) => [operation.path, operation]),
  );
  const recorded = new Map((manifest?.files ?? []).map((file) => [file.path, file]));
  const stale = new Set<string>();
  const modified = new Set<string>();
  const outdated = new Set<string>();

  for (const [path, operation] of expected) {
    const current = await readOptional(join(projectRoot, path));
    if (current === operation.content) {
      continue;
    }

    const previous = recorded.get(path);
    if (current !== null && previous && hashGeneratedContent(current) !== previous.sha256) {
      modified.add(path);
    } else {
      outdated.add(path);
    }
  }

  for (const [path, previous] of recorded) {
    if (expected.has(path)) {
      continue;
    }

    const current = await readOptional(join(projectRoot, path));
    if (current === null) {
      continue;
    }

    if (hashGeneratedContent(current) === previous.sha256) {
      stale.add(path);
    } else {
      modified.add(path);
    }
  }

  return {
    stale: [...stale].sort((left, right) => left.localeCompare(right)),
    modified: [...modified].sort((left, right) => left.localeCompare(right)),
    outdated: [...outdated].sort((left, right) => left.localeCompare(right)),
  };
}

function isGeneratedManifest(value: unknown): value is GeneratedManifest {
  if (!isRecord(value) || value.version !== 1 || typeof value.generatedWith !== "string" || !Array.isArray(value.files)) {
    return false;
  }

  const paths = new Set<string>();
  for (const file of value.files) {
    if (!isRecord(file) || typeof file.path !== "string" || typeof file.sha256 !== "string") {
      return false;
    }
    const normalizedPath = normalizeGeneratedPath(file.path);
    if (!isOwnedGeneratedPath(normalizedPath) || paths.has(normalizedPath) || !isSha256(file.sha256)) {
      return false;
    }
    paths.add(normalizedPath);
  }

  return true;
}

function normalizeGeneratedPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isSha256(value: string): boolean {
  return value.length === 64 && [...value].every((character) =>
    (character >= "0" && character <= "9") || (character >= "a" && character <= "f"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
