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

  it("detects Vite React without requiring a router", async () => {
    const stack = await detectStack(join(repoRoot, "tests", "fixtures", "vite-no-router"));

    expect(stack.name).toBe("vite-react");
    expect(stack.router).toBe("none");
    expect(stack.packages["react-router"].version).toBeNull();
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

  it("ignores capability names in comments and unrelated strings", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-structural-capability-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(
        join(rootDir, "next.config.ts"),
        [
          "// cacheComponents: true",
          "const note = 'reactCompiler: true and babel-plugin-react-compiler';",
          "export default { cacheComponents: false, reactCompiler: false, note };",
          "",
        ].join("\n"),
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.capabilities).toEqual({ reactCompiler: false, nextCacheComponents: false });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("only reads capabilities from configuration files that own them", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-scoped-capability-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(join(rootDir, "next.config.ts"), "export default { cacheComponents: false, reactCompiler: false };\n", "utf8");
      await writeFile(
        join(rootDir, "babel.config.js"),
        "module.exports = { cacheComponents: true, reactCompiler: true, plugins: [] };\n",
        "utf8",
      );
      await writeFile(
        join(rootDir, "vite.config.ts"),
        "export default { cacheComponents: true, reactCompiler: true };\n",
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.capabilities).toEqual({ reactCompiler: false, nextCacheComponents: false });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("only reads Next capabilities from the exported configuration object", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-exported-capability-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(
        join(rootDir, "next.config.ts"),
        [
          "const example = { cacheComponents: true, reactCompiler: true };",
          "const config = {",
          "  cacheComponents: false,",
          "  reactCompiler: false,",
          "  example,",
          "  inlineExample: { cacheComponents: true, reactCompiler: true },",
          "};",
          "export default config;",
          "",
        ].join("\n"),
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.capabilities).toEqual({ reactCompiler: false, nextCacheComponents: false });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("resolves defineConfig and CommonJS exports before reading capabilities", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-config-root-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { next: "^16.0.0", react: "^19.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(
        join(rootDir, "next.config.ts"),
        "export default defineConfig({ cacheComponents: true, reactCompiler: true });\n",
        "utf8",
      );
      await writeFile(
        join(rootDir, "babel.config.js"),
        "module.exports = { plugins: [['babel-plugin-react-compiler']] };\n",
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.capabilities).toEqual({ reactCompiler: true, nextCacheComponents: true });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("tracks every rich-text package recognized by the audit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-rich-text-packages-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
          private: true,
          dependencies: {
            react: "^19.0.0",
            vite: "^6.0.0",
            xss: "^1.0.15",
            "react-html-parser": "^2.0.2",
          },
        }, null, 2),
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.packages.xss.version).toBe("1.0.15");
      expect(stack.packages["react-html-parser"].version).toBe("2.0.2");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("recognizes the React Compiler only in a structural Babel plugins entry", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "node-boost-babel-capability-"));

    try {
      await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({ private: true, dependencies: { react: "^19.0.0", vite: "^6.0.0" } }, null, 2),
        "utf8",
      );
      await writeFile(
        join(rootDir, "babel.config.js"),
        "module.exports = { plugins: [['babel-plugin-react-compiler', { target: '19' }]] };\n",
        "utf8",
      );

      const stack = await detectStack(rootDir);

      expect(stack.capabilities.reactCompiler).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
