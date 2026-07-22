import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAudit } from "../../src/audit/engine.js";

describe("feature module resolution", () => {
  it("accepts public barrels through relative, default, and custom aliases", async () => {
    await withProject("public-api", async (projectRoot) => {
      await writeCheckout(
        projectRoot,
        [
          'import { cart } from "@/features/cart";',
          'import { cart as relativeCart } from "../cart";',
          'import { cart as domainCart } from "~domain/cart";',
          "export { cart, relativeCart, domainCart };",
        ].join("\n"),
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings).not.toContainEqual(expect.objectContaining({ rule: "NB-ARCH-001" }));
    });
  });

  it("rejects deep imports through aliases and a NodeNext .js specifier", async () => {
    await withProject("public-api", async (projectRoot) => {
      await writeCheckout(
        projectRoot,
        [
          'import { internal } from "@/features/cart/internal";',
          'import { internal as customInternal } from "~domain/cart/internal";',
          'import { internal as nodeInternal } from "../cart/internal.js";',
          "export { internal, customInternal, nodeInternal };",
        ].join("\n"),
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });
      const findings = result.findings.filter((finding) => finding.rule === "NB-ARCH-001");

      expect(findings).toHaveLength(3);
      expect(findings.every((finding) => finding.ref === "src/features/cart/internal.ts")).toBe(true);
    });
  });

  it("rejects every cross-feature public import in forbid mode", async () => {
    await withProject("forbid", async (projectRoot) => {
      await writeCheckout(
        projectRoot,
        [
          'import { cart } from "@/features/cart";',
          'import { cart as relativeCart } from "../cart";',
          'import { cart as domainCart } from "~domain/cart";',
          "export { cart, relativeCart, domainCart };",
        ].join("\n"),
      );

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings.filter((finding) => finding.rule === "NB-ARCH-001")).toHaveLength(3);
    });
  });

  it("resolves app imports for NB-ARCH-002", async () => {
    await withProject("public-api", async (projectRoot) => {
      await writeCheckout(projectRoot, 'import { page } from "@/app/page";\nexport { page };');

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-ARCH-002",
        ref: "src/app/page.ts",
      }));
    });
  });

  it("reports a warning when a project import cannot be resolved", async () => {
    await withProject("public-api", async (projectRoot) => {
      await writeCheckout(projectRoot, 'import "../missing";');

      const result = await runAudit({ rootDir: projectRoot, mode: "all" });

      expect(result.findings).toContainEqual(expect.objectContaining({
        rule: "NB-META-006",
        sev: "warn",
        code: "module-resolution-failed",
        ref: "../missing",
      }));
    });
  });
});

async function withProject(boundary: "public-api" | "forbid", fn: (projectRoot: string) => Promise<void>): Promise<void> {
  const projectRoot = await mkdtemp(join(tmpdir(), "node-boost-features-"));

  try {
    await Promise.all([
      mkdir(join(projectRoot, "src", "features", "cart"), { recursive: true }),
      mkdir(join(projectRoot, "src", "features", "checkout"), { recursive: true }),
      mkdir(join(projectRoot, "src", "app"), { recursive: true }),
    ]);
    await writeFile(
      join(projectRoot, "package.json"),
      `${JSON.stringify({ private: true, dependencies: { react: "^19.0.0", vite: "^6.0.0", "react-router": "^7.0.0" } }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectRoot, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", baseUrl: ".", paths: { "@/*": ["src/*"], "~domain/*": ["src/features/*"] } } }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      join(projectRoot, "node-boost.json"),
      `${JSON.stringify(
        {
          version: 1,
          generatedWith: "0.1.0",
          stack: "vite-react",
          agents: [],
          features: { guidelines: false, skills: false, mcp: false, architecture: true, hooks: false },
          architectures: [{ name: "feature-modules", boundary }],
          audit: { exclude: [], rules: {}, ruleOptions: {} },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(join(projectRoot, "src", "features", "cart", "index.ts"), "export const cart = {};\n", "utf8");
    await writeFile(join(projectRoot, "src", "features", "cart", "internal.ts"), "export const internal = {};\n", "utf8");
    await writeFile(join(projectRoot, "src", "app", "page.ts"), "export const page = {};\n", "utf8");
    await fn(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

async function writeCheckout(projectRoot: string, source: string): Promise<void> {
  await writeFile(join(projectRoot, "src", "features", "checkout", "useCheckout.ts"), `${source}\n`, "utf8");
}
