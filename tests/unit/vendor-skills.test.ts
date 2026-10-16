import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { composeVendorSkills, vendorSkills, vendorSkillsRoot } from "../../src/compose/vendor-skills.js";
import { detectStack } from "../../src/detect/stack.js";
import { runInstall, runUpdate } from "../../src/install/orchestrator.js";
import { syncVendorSkills } from "../../scripts/vendor-skill-sync.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>();
  return { ...original, rename: vi.fn(original.rename), readdir: vi.fn(original.readdir) };
});

const packageRoot = join(import.meta.dirname, "../..");
const roots: string[] = [];
async function temporary() {
  const root = await mkdtemp(join(tmpdir(), "nb-vendor-test-"));
  roots.push(root);
  return root;
}
afterEach(async () => { vi.mocked(fs.rename).mockReset(); vi.mocked(fs.rename).mockImplementation((await vi.importActual<typeof fs>("node:fs/promises")).rename); vi.mocked(fs.readdir).mockReset(); vi.mocked(fs.readdir).mockImplementation((await vi.importActual<typeof fs>("node:fs/promises")).readdir); await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function sources() {
  const root = await temporary();
  for (const skill of vendorSkills) {
    const path = join(root, skill.source.directory, skill.upstreamDirectory);
    await mkdir(join(path, "references"), { recursive: true });
    await writeFile(join(path, "SKILL.md"), `---\nname: ${skill.name}\ndescription: fixture\n---\n`);
    await writeFile(join(path, "references", "guide.md"), "reference");
    await writeFile(join(path, "metadata.json"), "{}");
  }
  return root;
}

describe("vendor skill corrections", () => {
  it.each(["15.5.0", "16.0.0", "16.1.0", "16.2.9", null, "unknown"])("omits Next workflows for unsupported version %s", async (version) => {
    const stack = await detectStack(join(packageRoot, "tests/fixtures/next-app"));
    stack.packages.next = { ...stack.packages.next, version, major: version ? Number.parseInt(version) : null };
    const files = await composeVendorSkills(packageRoot, stack);
    expect(files.some((file) => file.outputPath.split("/")[2].startsWith("next-"))).toBe(false);
  });
  it.each(["16.3.0", "16.4.0", "17.0.0"])("includes Next workflows for supported version %s", async (version) => {
    const stack = await detectStack(join(packageRoot, "tests/fixtures/next-app"));
    stack.packages.next = { ...stack.packages.next, version, major: Number.parseInt(version) };
    const files = await composeVendorSkills(packageRoot, stack);
    expect(files.filter((file) => /\/next-[^/]+\/SKILL.md$/.test(file.outputPath))).toHaveLength(6);
  });
  it.each(["missing", "invalid-directory", "empty"])("fails closed on %s vendor resources before update writes", async (failure) => {
    const root = await temporary();
    const damagedPackage = await temporary();
    await cp(join(packageRoot, "resources"), join(damagedPackage, "resources"), { recursive: true });
    await cp(join(packageRoot, "package.json"), join(damagedPackage, "package.json"));
    await cp(join(packageRoot, "schema.json"), join(damagedPackage, "schema.json"));
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { vite: "^7.0.0", react: "^19.0.0" } }));
    await runInstall({ cwd: root, packageRoot: damagedPackage, noInteraction: true });
    const skillPath = join(root, ".ai/skills/web-design-guidelines/SKILL.md");
    const before = await readFile(skillPath, "utf8");
    const { generatedManifestPath } = await import("../../src/install/generated-manifest.js");
    const manifest = await readFile(join(root, generatedManifestPath), "utf8");
    const dir = join(damagedPackage, vendorSkillsRoot, "web-design-guidelines");
    await rm(dir, { recursive: true });
    if (failure === "invalid-directory") await writeFile(dir, "not a directory");
    if (failure === "empty") await mkdir(dir);
    await expect(runUpdate({ cwd: root, packageRoot: damagedPackage })).rejects.toThrow();
    expect(await readFile(skillPath, "utf8")).toBe(before);
    expect(await readFile(join(root, generatedManifestPath), "utf8")).toBe(manifest);
  });
  it("rejects an upstream LICENSE.md collision before composing duplicate outputs", async () => {
    const root = await temporary();
    const stack = await detectStack(join(packageRoot, "tests/fixtures/vite-app"));
    for (const skill of vendorSkills.filter((skill) => skill.appliesTo(stack))) {
      const dir = join(root, vendorSkillsRoot, skill.name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "SKILL.md"), "entrypoint");
    }
    await writeFile(join(root, vendorSkillsRoot, "web-design-guidelines", "LICENSE.md"), "upstream notice");
    await expect(composeVendorSkills(root, stack)).rejects.toThrow("LICENSE.md conflicts");
  });
  it("propagates a vendor directory permission failure", async () => {
    const stack = await detectStack(join(packageRoot, "tests/fixtures/vite-app"));
    vi.mocked(fs.readdir).mockRejectedValueOnce(Object.assign(new Error("Access denied"), { code: "EACCES" }));
    await expect(composeVendorSkills(packageRoot, stack)).rejects.toMatchObject({ code: "EACCES" });
  });
  it.each([undefined, "single-agent"] as const)("installs MIT notice with nested files in %s layout", async (layout) => {
    const root = await temporary();
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { next: "16.3.0", react: "19.0.0" } }));
    await runInstall({ cwd: root, packageRoot, noInteraction: true });
    if (layout) {
      const config = JSON.parse(await readFile(join(root, "node-boost.json"), "utf8")) as Record<string, unknown>;
      await writeFile(join(root, "node-boost.json"), JSON.stringify({ ...config, agents: ["codex"], skillLayout: layout }));
      await runUpdate({ cwd: root, packageRoot });
    }
    for (const dir of layout ? [".agents/skills"] : [".ai/skills", ".agents/skills", ".claude/skills"]) {
      for (const skill of vendorSkills) {
        const notice = await readFile(join(root, dir, skill.name, "LICENSE.md"), "utf8");
        expect(notice).toContain("Copyright (c) 2025 Vercel, Inc.");
        expect(notice).toContain("shall be included in all");
      }
      expect(await readFile(join(root, dir, "vercel-optimize/scripts/scan-codebase.mjs"), "utf8")).toContain("import");
    }
    expect((await runUpdate({ cwd: root, packageRoot })).operations.every((operation) => operation.status === "skipped")).toBe(true);
  });
  it("preserves the old tree on partial copy failure and replaces it only on success", async () => {
    const root = await temporary();
    const target = join(root, "skills");
    await mkdir(target);
    await writeFile(join(target, "old.md"), "previous tree");
    await writeFile(join(target, "sources.json"), "previous manifest");
    const upstream = await sources();
    const last = vendorSkills.at(-1)!;
    const lastDir = join(upstream, last.source.directory, last.upstreamDirectory);
    await rm(join(lastDir, "SKILL.md"));
    const resolve = () => ({ directory: upstream, commit: "fixture-sha" });
    await expect(syncVendorSkills(target, resolve)).rejects.toThrow();
    expect(await readFile(join(target, "old.md"), "utf8")).toBe("previous tree");
    expect(await readFile(join(target, "sources.json"), "utf8")).toBe("previous manifest");
    await writeFile(join(lastDir, "SKILL.md"), "---\nname: fixture\ndescription: fixture\n---\n");
    await syncVendorSkills(target, resolve);
    await expect(readFile(join(target, "old.md"))).rejects.toThrow();
    const manifest = JSON.parse(await readFile(join(target, "sources.json"), "utf8")) as { skills: unknown[] };
    expect(manifest.skills).toHaveLength(vendorSkills.length);
    for (const skill of vendorSkills) {
      expect(await readFile(join(target, skill.name, "references/guide.md"), "utf8")).toBe("reference");
      await expect(readFile(join(target, skill.name, "metadata.json"))).rejects.toThrow();
    }
  });
  it("restores the previous tree if publication fails", async () => {
    const root = await temporary();
    const target = join(root, "skills");
    await mkdir(target);
    await writeFile(join(target, "old.md"), "previous tree");
    const upstream = await sources();
    const original = (await vi.importActual<typeof fs>("node:fs/promises")).rename;
    vi.mocked(fs.rename).mockImplementationOnce(original).mockRejectedValueOnce(new Error("Publication denied"));
    await expect(syncVendorSkills(target, () => ({ directory: upstream, commit: "fixture-sha" }))).rejects.toThrow("Publication denied");
    expect(await readFile(join(target, "old.md"), "utf8")).toBe("previous tree");
  });
  it.each(["symlink", "LICENSE.md"])("rejects an upstream %s without touching the current tree", async (hazard) => {
    const root = await temporary();
    const target = join(root, "skills");
    await mkdir(target);
    await writeFile(join(target, "old.md"), "previous tree");
    const upstream = await sources();
    const skill = vendorSkills[0];
    const dir = join(upstream, skill.source.directory, skill.upstreamDirectory);
    // A junction needs no elevated rights on Windows; the type is ignored elsewhere.
    if (hazard === "symlink") await symlink(join(dir, "references"), join(dir, "linked"), "junction");
    else await writeFile(join(dir, "LICENSE.md"), "upstream notice");
    await expect(syncVendorSkills(target, () => ({ directory: upstream, commit: "fixture-sha" })))
      .rejects.toThrow(hazard === "symlink" ? "must not contain symlinks" : "LICENSE.md conflicts");
    expect(await readFile(join(target, "old.md"), "utf8")).toBe("previous tree");
  });
  it("rejects concurrent sync without touching the current tree", async () => {
    const root = await temporary();
    const target = join(root, "skills");
    await mkdir(target);
    await mkdir(`${target}.sync-lock`);
    await writeFile(join(target, "old.md"), "previous tree");
    await expect(syncVendorSkills(target, () => { throw new Error("must not read sources"); })).rejects.toThrow();
    expect(await readFile(join(target, "old.md"), "utf8")).toBe("previous tree");
  });
});
