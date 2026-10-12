import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vendorSkills, vendorSkillsRoot, type VendorSkillSource } from "../src/compose/vendor-skills.js";

// Mirrors the files `npx skills add` skips when it installs a skill.
const excludedFiles = new Set(["metadata.json"]);
const excludedDirectories = new Set([".git", "__pycache__", "__pypackages__"]);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const targetRoot = join(repoRoot, vendorSkillsRoot);
const workDir = await mkdtemp(join(tmpdir(), "node-boost-vendor-skills-"));

try {
  const sources = [...new Map(vendorSkills.map((skill) => [skill.source.repository, skill.source])).values()];
  const commits = new Map<string, string>();
  for (const source of sources) {
    commits.set(source.repository, checkout(source, workDir));
  }

  await rm(targetRoot, { recursive: true, force: true });
  for (const skill of vendorSkills) {
    const from = join(checkoutDir(skill.source, workDir), skill.source.directory, skill.upstreamDirectory);
    await cp(from, join(targetRoot, skill.name), {
      recursive: true,
      filter: (path) => !excludedFiles.has(basename(path)) && !excludedDirectories.has(basename(path)),
    });
  }

  const manifest = {
    skills: vendorSkills.map((skill) => ({
      name: skill.name,
      repository: skill.source.repository,
      path: `${skill.source.directory}/${skill.upstreamDirectory}`,
      commit: commits.get(skill.source.repository),
    })),
  };
  await writeFile(join(targetRoot, "sources.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
} finally {
  await rm(workDir, { recursive: true, force: true });
}

function checkoutDir(source: VendorSkillSource, root: string): string {
  return join(root, source.repository.replace(/^https:\/\/github\.com\//, "").replaceAll("/", "__"));
}

function checkout(source: VendorSkillSource, root: string): string {
  const dir = checkoutDir(source, root);
  execFileSync("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", source.repository, dir], { stdio: "inherit" });
  execFileSync("git", ["-C", dir, "sparse-checkout", "set", source.directory], { stdio: "inherit" });
  return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}
