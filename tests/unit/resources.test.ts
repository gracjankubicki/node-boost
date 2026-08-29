import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { explainEntries } from "../../src/audit/registry.js";

const repoRoot = join(import.meta.dirname, "..", "..");

describe("resources", () => {
  it("validates frontmatter on every SKILL.md", async () => {
    const skillFiles = (await walk(join(repoRoot, "resources"))).filter((file) => file.endsWith("SKILL.md"));

    expect(skillFiles.length).toBeGreaterThan(0);

    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      expect(content, file).toMatch(/^---\n[\s\S]*?\n---/);
      expect(content, file).toMatch(/\nname:\s*\S+/);
      expect(content, file).toMatch(/\ndescription:\s*\S+/);
      expect(content, file).toContain("## When to use this skill");
    }
  });

  it("keeps every explain registry rule represented in its architecture guideline", async () => {
    for (const entry of explainEntries.values()) {
      const files = (await Promise.all([
        walk(join(repoRoot, "resources", "react", "architectures", entry.architecture)),
        walk(join(repoRoot, "resources", "stacks", "astro", "architectures", entry.architecture)),
      ])).flat();
      const guidelineText = (await Promise.all(files.filter((file) => file.endsWith(".md")).map((file) => readFile(file, "utf8")))).join("\n");

      expect(guidelineText, `${entry.rule} ${entry.architecture}`).toContain(entry.rule);
    }
  });
});

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(path);
      }

      return entry.isFile() ? [path] : [];
    }),
  );

  return nested.flat().sort((a, b) => a.localeCompare(b));
}
