import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectStack } from "../../src/detect/stack.js";
import { getStackAdapter } from "../../src/stacks/adapter.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("stack adapters", () => {
  it("returns Next-only architectures for Next projects", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "next-app"));
    const adapter = getStackAdapter(stack);

    expect(adapter?.name).toBe("next");
    expect(adapter?.recommendedArchitectures(stack)).toContain("server-first-components");
    expect(adapter?.recommendedArchitectures(stack)).toContain("error-loading-boundaries");
    expect(adapter?.recommendedArchitectures(stack)).toContain("secure-by-default");
    expect(adapter?.recommendedArchitectures(stack)).toContain("modern-typescript");
    expect(adapter?.recommendedArchitectures(stack)).toContain("styling-tailwind");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("feature-modules");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("component-composition");
  });

  it("does not return Next-only architectures for Vite React projects", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-app"));
    const adapter = getStackAdapter(stack);

    expect(adapter?.name).toBe("vite-react");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("server-first-components");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("error-loading-boundaries");
    expect(adapter?.recommendedArchitectures(stack)).toContain("secure-by-default");
    expect(adapter?.recommendedArchitectures(stack)).toContain("modern-typescript");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("feature-modules");
    expect(adapter?.recommendedArchitectures(stack)).not.toContain("ui-states");
  });
});
