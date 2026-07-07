import { join } from "node:path";
import type { DetectedStack, ResourceSelection } from "../types.js";
import { listResourceFiles } from "./resources.js";

export async function composeSkills(rootDir: string, stack: DetectedStack): Promise<ResourceSelection[]> {
  const availableFiles = await listResourceFiles(rootDir, "skills");
  const selected = new Set<string>();

  if (stack.packages.react?.version) {
    selected.add("react-development/SKILL.md");
  }

  if (stack.name === "next") {
    selected.add("next-development/SKILL.md");
  }

  if (stack.name === "vite-react") {
    selected.add("spa-routing/SKILL.md");
  }

  if (stack.packages.tailwindcss?.version) {
    selected.add("tailwindcss-development/SKILL.md");
  }

  if (stack.packages.vitest?.version || stack.packages.playwright?.version) {
    selected.add("testing-frontend/SKILL.md");
  }

  return [...selected]
    .filter((file) => availableFiles.includes(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => ({
      kind: "skill",
      sourcePath: join("resources", "react", "skills", file),
      outputPath: join(".ai", "skills", file),
    }));
}
