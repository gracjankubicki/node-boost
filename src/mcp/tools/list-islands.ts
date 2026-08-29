import { inspectAstroProject, type AstroIslandInfo } from "../../astro/project.js";
import { detectStack } from "../../detect/stack.js";

export interface UnsupportedIslands {
  supported: false;
  reason: string;
}

export async function listIslandsTool(rootDir: string): Promise<AstroIslandInfo[] | UnsupportedIslands> {
  const stack = await detectStack(rootDir);
  if (stack.name !== "astro" || !stack.astro) {
    return { supported: false, reason: "island maps are available for Astro projects" };
  }
  return (await inspectAstroProject(rootDir, stack.astro)).islands;
}
