import { join } from "node:path";
import type { DetectedStack, ResourceSelection } from "../types.js";
import { listResourceFiles } from "./resources.js";

const packageResourceMap: Record<string, string> = {
  react: "react",
  next: "next",
  vite: "vite",
  "react-router": "react-router",
  zod: "zod",
  "@tanstack/react-query": "react-query",
  zustand: "zustand",
  typescript: "typescript",
  tailwindcss: "tailwindcss",
  vitest: "testing",
  playwright: "testing",
};

export async function composeGuidelines(rootDir: string, stack: DetectedStack): Promise<ResourceSelection[]> {
  const availableFiles = await listResourceFiles(rootDir, "guidelines");
  const selected = new Set<string>(["core.md"]);

  for (const [packageName, resourceName] of Object.entries(packageResourceMap)) {
    const packageInfo = stack.packages[packageName];

    if (!packageInfo?.version) {
      continue;
    }

    addIfAvailable(selected, availableFiles, `${resourceName}/core.md`);

    if (packageInfo.major !== null) {
      addIfAvailable(selected, availableFiles, `${resourceName}/${packageInfo.major}.md`);
    }
  }

  if (stack.packages.vitest?.version) {
    addIfAvailable(selected, availableFiles, "testing/vitest.md");
  }

  if (stack.packages.playwright?.version) {
    addIfAvailable(selected, availableFiles, "testing/playwright.md");
  }

  return [...selected]
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      kind: "guideline",
      sourcePath: join("resources", "react", "guidelines", file),
      outputPath: join(".ai", "guidelines", file),
    }));
}

function addIfAvailable(selected: Set<string>, availableFiles: string[], file: string): void {
  if (availableFiles.includes(file)) {
    selected.add(file);
  }
}
