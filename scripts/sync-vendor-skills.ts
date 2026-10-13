import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { vendorSkills, vendorSkillsRoot, type VendorSkillSource } from "../src/compose/vendor-skills.js";

import { syncVendorSkills } from "./vendor-skill-sync.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const targetRoot = join(repoRoot, vendorSkillsRoot);
const workDir = await mkdtemp(join(tmpdir(), "node-boost-vendor-skills-"));

try {
  const sources = [...new Map(vendorSkills.map((skill) => [skill.source.repository, skill.source])).values()];
  const commits = new Map<string, string>();
  for (const source of sources) {
    commits.set(source.repository, checkout(source, workDir));
  }

  await syncVendorSkills(targetRoot, (source) => ({
    directory: checkoutDir(source, workDir),
    commit: commits.get(source.repository)!,
  }));
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
