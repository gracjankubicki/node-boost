import { createRequire } from "node:module";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { NormalizedArchitecture, ResourceSelection, StackName } from "../types.js";
import {
  defineNodeBoostPlugin,
  type NodeBoostPluginArchitecture,
  type NodeBoostPluginDefinition,
} from "./index.js";

export interface LoadedNodeBoostPlugin {
  packageName: string;
  packageRoot: string;
  definition: Readonly<NodeBoostPluginDefinition>;
}

export interface ResolvedPluginArchitecture {
  id: string;
  packageName: string;
  slug: string;
  variant?: string;
  guidelinePath: string;
  skillPath: string;
}

export async function loadNodeBoostPlugins(projectRoot: string, packageNames: readonly string[]): Promise<LoadedNodeBoostPlugin[]> {
  const loaded = await Promise.all(packageNames.map((packageName) => loadPlugin(projectRoot, packageName)));
  const architectureIds = new Set<string>();

  for (const plugin of loaded) {
    for (const architecture of plugin.definition.architectures) {
      const id = architectureId(plugin.packageName, architecture.slug);
      if (architectureIds.has(id)) {
        throw new Error(`Duplicate node-boost plugin architecture: ${id}.`);
      }
      architectureIds.add(id);
    }
  }

  return loaded.sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function resolvePluginArchitectures(
  plugins: readonly LoadedNodeBoostPlugin[],
  architectures: readonly NormalizedArchitecture[],
  stack: StackName,
): ResolvedPluginArchitecture[] {
  const available = new Map<string, { plugin: LoadedNodeBoostPlugin; architecture: NodeBoostPluginArchitecture }>();
  for (const plugin of plugins) {
    for (const architecture of plugin.definition.architectures) {
      available.set(architectureId(plugin.packageName, architecture.slug), { plugin, architecture });
    }
  }

  return architectures.flatMap((selected) => {
    if (!selected.name.includes(":")) {
      return [];
    }
    const match = available.get(selected.name);
    if (!match) {
      throw new Error(`Unknown node-boost plugin architecture: ${selected.name}.`);
    }
    if (!match.architecture.stacks.some((supported) => supported === stack)) {
      throw new Error(`Node-boost plugin architecture ${selected.name} does not support stack ${stack}.`);
    }

    const variant = typeof selected.options.variant === "string" ? selected.options.variant : undefined;
    const variantResources = variant ? match.architecture.resources.variants?.[variant] : undefined;
    if (variant && !variantResources) {
      throw new Error(`Unknown variant ${variant} for node-boost plugin architecture ${selected.name}.`);
    }

    return [{
      id: selected.name,
      packageName: match.plugin.packageName,
      slug: match.architecture.slug,
      ...(variant ? { variant } : {}),
      guidelinePath: join(match.plugin.packageRoot, variantResources?.guideline ?? match.architecture.resources.guideline),
      skillPath: join(match.plugin.packageRoot, variantResources?.skill ?? match.architecture.resources.skill),
    }];
  });
}

export function pluginResourceSelections(
  architectures: readonly ResolvedPluginArchitecture[],
): { guidelines: ResourceSelection[]; skills: ResourceSelection[] } {
  return {
    guidelines: architectures.map((architecture) => ({
      kind: "guideline",
      sourcePath: architecture.guidelinePath,
      outputPath: join(
        ".ai",
        "guidelines",
        "architectures",
        "plugins",
        architecture.packageName,
        `${architecture.slug}.md`,
      ),
      pluginPackage: architecture.packageName,
    })),
    skills: architectures.map((architecture) => ({
      kind: "skill",
      sourcePath: architecture.skillPath,
      outputPath: join(
        ".ai",
        "skills",
        "plugins",
        architecture.packageName,
        architecture.slug,
        "SKILL.md",
      ),
      pluginPackage: architecture.packageName,
    })),
  };
}

function architectureId(packageName: string, slug: string): string {
  return `${packageName}:${slug}`;
}

async function loadPlugin(projectRoot: string, packageName: string): Promise<LoadedNodeBoostPlugin> {
  const require = createRequire(join(projectRoot, "package.json"));
  let entryPath: string;
  try {
    entryPath = require.resolve(packageName);
  } catch (error) {
    throw new Error(`Cannot resolve node-boost plugin ${packageName} from ${projectRoot}.`, { cause: error });
  }

  const packageRoot = await findPackageRoot(entryPath, packageName);
  const imported = await import(pathToFileURL(entryPath).href) as { default?: unknown };
  if (imported.default === undefined) {
    throw new Error(`Node-boost plugin ${packageName} must export its definition as default.`);
  }
  const definition = defineNodeBoostPlugin(imported.default as NodeBoostPluginDefinition);
  if (definition.name !== packageName) {
    throw new Error(`Node-boost plugin ${packageName} declares mismatched name ${definition.name}.`);
  }

  await validatePluginResources(packageRoot, definition);
  return { packageName, packageRoot, definition };
}

async function findPackageRoot(entryPath: string, packageName: string): Promise<string> {
  let current = dirname(entryPath);
  for (;;) {
    const packageJsonPath = join(current, "package.json");
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { name?: string };
      if (packageJson.name === packageName) {
        return await realpath(current);
      }
    } catch {
      // Keep walking until the matching package manifest is found.
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Cannot locate package root for node-boost plugin ${packageName}.`);
    }
    current = parent;
  }
}

async function validatePluginResources(packageRoot: string, definition: Readonly<NodeBoostPluginDefinition>): Promise<void> {
  for (const architecture of definition.architectures) {
    await assertResource(packageRoot, definition.name, architecture.resources.guideline);
    await assertResource(packageRoot, definition.name, architecture.resources.skill);
    for (const resources of Object.values(architecture.resources.variants ?? {})) {
      if (resources.guideline) {
        await assertResource(packageRoot, definition.name, resources.guideline);
      }
      if (resources.skill) {
        await assertResource(packageRoot, definition.name, resources.skill);
      }
    }
  }
}

async function assertResource(packageRoot: string, packageName: string, resourcePath: string): Promise<void> {
  const target = resolve(packageRoot, resourcePath);
  if (isAbsolute(resourcePath) || isOutside(packageRoot, target)) {
    throw new Error(`Node-boost plugin ${packageName} resource escapes its package: ${resourcePath}.`);
  }
  let resolvedTarget: string;
  try {
    resolvedTarget = await realpath(target);
  } catch (error) {
    throw new Error(`Node-boost plugin ${packageName} resource does not exist: ${resourcePath}.`, { cause: error });
  }
  if (isOutside(packageRoot, resolvedTarget)) {
    throw new Error(`Node-boost plugin ${packageName} resource symlink escapes its package: ${resourcePath}.`);
  }
}

function isOutside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === ".." || path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(path);
}
