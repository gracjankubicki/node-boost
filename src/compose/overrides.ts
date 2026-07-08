import { access } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ResourceSelection } from "../types.js";

export async function applyResourceOverrides(projectRoot: string, resources: ResourceSelection[]): Promise<ResourceSelection[]> {
  return Promise.all(resources.map((resource) => applyResourceOverride(projectRoot, resource)));
}

async function applyResourceOverride(projectRoot: string, resource: ResourceSelection): Promise<ResourceSelection> {
  const outputRelative = normalize(relative(join(".ai", resource.kind === "guideline" ? "guidelines" : "skills"), resource.outputPath));
  const overridePath = join(projectRoot, ".node-boost", resource.kind === "guideline" ? "guidelines" : "skills", outputRelative);

  try {
    await access(overridePath);
    return {
      ...resource,
      sourcePath: overridePath,
    };
  } catch {
    return resource;
  }
}

function normalize(path: string): string {
  return path.split("\\").join("/");
}
