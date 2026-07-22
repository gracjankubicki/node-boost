import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export async function listResourceFiles(rootDir: string, kind: "guidelines" | "skills"): Promise<string[]> {
  const baseDir = join(rootDir, "resources", "react", kind);
  const files = await walkMarkdownFiles(baseDir);
  return files.map((file) => relative(baseDir, file).replaceAll("\\", "/")).sort((a, b) => a.localeCompare(b));
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath);
      }

      if (entry.isFile() && (entry.name.endsWith(".md") || entry.name === "SKILL.md")) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}
