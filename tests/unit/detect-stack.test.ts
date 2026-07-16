import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

  it("detects a Vite SPA from react-router-dom and tracks selection capabilities", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-detect-"));

    try {
      await mkdir(join(rootDir, "src"), { recursive: true });
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify(
          {
            private: true,
            dependencies: {
              react: "^18.3.0",
              vite: "^5.0.0",
              "react-router-dom": "^6.28.0",
              swr: "^2.0.0",
              valibot: "^1.0.0",
              "react-hook-form": "^7.0.0",
            },
            devDependencies: { jest: "^30.0.0", msw: "^2.0.0", "@storybook/react": "^8.0.0" },
          },
          null,
          2,
        ),
        "utf8",
      );
      await writeFile(
        join(rootDir, "vite.config.ts"),
        'export default { react: { babel: { plugins: ["babel-plugin-react-compiler"] } } };\n',
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.name).toBe("vite-react");
      expect(stack.packages["react-router-dom"].major).toBe(6);
      expect(stack.packages.swr.major).toBe(2);
      expect(stack.packages.valibot.major).toBe(1);
      expect(stack.packages.jest.major).toBe(30);
      expect(stack.packages.msw.major).toBe(2);
      expect(stack.packages["@storybook/react"].major).toBe(8);
      expect(stack.capabilities).toEqual({ reactCompiler: true, nextCacheComponents: false });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("detects Next Cache Components independently from the Next major", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-next-capability-"));

    try {
      await mkdir(join(rootDir, "src", "app"), { recursive: true });
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(join(rootDir, "next.config.ts"), "export default { cacheComponents: true };\n", "utf8");

      const stack = await detectStack(rootDir);

      expect(stack.packages.next.major).toBe(16);
      expect(stack.capabilities).toEqual({ reactCompiler: false, nextCacheComponents: true });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
