import { inspectAstroProject, type AstroArchitectureMap } from "../../astro/project.js";
import { detectStack } from "../../detect/stack.js";

export interface AstroArchitectureMapResult extends AstroArchitectureMap {
  supported: true;
}

export interface UnsupportedArchitectureMap {
  supported: false;
  reason: string;
}

export async function architectureMapTool(
  rootDir: string,
): Promise<AstroArchitectureMapResult | UnsupportedArchitectureMap> {
  const stack = await detectStack(rootDir);
  if (stack.name !== "astro" || !stack.astro) {
    return { supported: false, reason: "architecture maps are available for Astro projects" };
  }
  return {
    supported: true,
    ...(await inspectAstroProject(rootDir, stack.astro)).architecture,
  };
}
