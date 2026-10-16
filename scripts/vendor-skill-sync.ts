import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { vendorSkills, type VendorSkillSource } from "../src/compose/vendor-skills.js";

const excludedFiles = new Set(["metadata.json"]);
const excludedDirectories = new Set([".git", "__pycache__", "__pypackages__"]);

// Stage on the same filesystem. Keep the old tree until publication succeeds.
export async function syncVendorSkills(
  targetRoot: string,
  resolveSource: (source: VendorSkillSource) => { directory: string; commit: string },
): Promise<void> {
  await mkdir(dirname(targetRoot), { recursive: true });
  const lock = `${targetRoot}.sync-lock`;
  await mkdir(lock);
  let transaction: string | undefined;
  let keepBackup = false;
  try {
    transaction = await mkdtemp(join(dirname(targetRoot), ".skills-sync-"));
    const staged = join(transaction, "staged");
    const backup = join(transaction, "backup");
    const records = [];
    const checkedDirectories = new Set<string>();
    for (const skill of vendorSkills) {
      const source = resolveSource(skill.source);
      const skillsDirectory = join(source.directory, skill.source.directory);
      const from = join(skillsDirectory, skill.upstreamDirectory);
      // Fail before publication if an upstream skill was removed or moved.
      const entry = await readFile(join(from, "SKILL.md"), "utf8");
      if (!/^---\r?\n[\s\S]*?\r?\n---/.test(entry)) throw new Error(`Invalid SKILL.md: ${from}`);
      if (existsSync(join(from, "LICENSE.md"))) throw new Error(`Upstream LICENSE.md conflicts with the generated notice: ${from}`);
      if (!checkedDirectories.has(skillsDirectory)) {
        await assertLinksStayInside(skillsDirectory, source.directory);
        checkedDirectories.add(skillsDirectory);
      }
      // Dereference so consumers get plain files; broken links and cycles make cp() fail here.
      await cp(from, join(staged, skill.name), {
        recursive: true,
        dereference: true,
        filter: (path) => !excludedFiles.has(basename(path)) && !excludedDirectories.has(basename(path)),
      });
      records.push({ name: skill.name, repository: skill.source.repository,
        path: `${skill.source.directory}/${skill.upstreamDirectory}`, commit: source.commit });
    }
    await writeFile(join(staged, "sources.json"), `${JSON.stringify({ skills: records }, null, 2)}\n`, "utf8");
    let hasBackup = false;
    try {
      await rename(targetRoot, backup);
      hasBackup = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await rename(staged, targetRoot);
    } catch (error) {
      if (hasBackup) {
        try { await rename(backup, targetRoot); }
        catch (rollbackError) {
          keepBackup = true;
          throw new AggregateError([error, rollbackError], `Sync rollback failed; previous skills retained at ${backup}`, { cause: rollbackError });
        }
      }
      throw error;
    }
  } finally {
    try {
      if (transaction && !keepBackup) await rm(transaction, { recursive: true, force: true });
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}

// The sparse checkout only materialises the skills directory, so every link cp() may follow
// lives there; checking them all also covers links nested in linked directories. Never
// publish files from the maintainer's machine. Links into paths outside the sparse checkout
// (e.g. next.js's root readme.md) are broken; skip them, cp() fails if a skill uses one.
async function assertLinksStayInside(directory: string, checkout: string): Promise<void> {
  const root = await realpath(checkout);
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    const path = join(entry.parentPath, entry.name);
    const target = await realpath(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!target) continue;
    const fromRoot = relative(root, target);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new Error(`Vendored skill symlink points outside the upstream checkout: ${path}`);
    }
  }
}
