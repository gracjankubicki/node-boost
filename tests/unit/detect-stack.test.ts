import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectStack, extractVersionFromRange } from "../../src/detect/stack.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("detectStack", () => {
  it("detects a Next app router project from package ranges", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));

    expect(stack.name).toBe("next");
    expect(stack.router).toBe("app");
    expect(stack.srcDir).toBe(true);
    expect(stack.packageManager.name).toBe("npm");
    expect(stack.packageManager.source).toBe("lockfile");
    expect(stack.linting).toBe("eslint-prettier");
    expect(stack.packages.next.version).toBe("16.2.9");
    expect(stack.packages.next.major).toBe(16);
    expect(stack.packages.next.source).toBe("range");
  });

  it("detects a Vite React Router project", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));

    expect(stack.name).toBe("vite-react");
    expect(stack.router).toBe("react-router");
    expect(stack.linting).toBe("biome");
    expect(stack.packageManager.name).toBe("pnpm");
    expect(stack.packageManager.source).toBe("lockfile");
    expect(stack.packages["react-router"].major).toBe(7);
  });

  it("extracts the minimal version from package ranges", () => {
    expect(extractVersionFromRange("^16.2.9")).toBe("16.2.9");
    expect(extractVersionFromRange("~7.1")).toBe("7.1.0");
    expect(extractVersionFromRange("19")).toBe("19.0.0");
    expect(extractVersionFromRange("workspace:*")).toBeNull();
  });
});
