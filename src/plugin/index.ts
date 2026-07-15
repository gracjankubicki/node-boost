/** Stable content-only extension contract for node-boost plugins. */

export type NodeBoostPluginStack = "next" | "vite-react" | "react-generic";

export interface NodeBoostPluginVariantResources {
  guideline?: string;
  skill?: string;
}

export interface NodeBoostPluginResources {
  guideline: string;
  skill: string;
  variants?: Record<string, NodeBoostPluginVariantResources>;
}

export interface NodeBoostPluginArchitecture {
  slug: string;
  title: string;
  description?: string;
  stacks: NodeBoostPluginStack[];
  resources: NodeBoostPluginResources;
}

export interface NodeBoostPluginDefinition {
  apiVersion: 1;
  name: string;
  architectures: NodeBoostPluginArchitecture[];
}

export function defineNodeBoostPlugin<const T extends NodeBoostPluginDefinition>(input: T): Readonly<T> {
  validateExactKeys(input, ["apiVersion", "architectures", "name"], "plugin");
  if (input.apiVersion !== 1) {
    throw new Error("Invalid node-boost plugin: apiVersion must be 1.");
  }
  if (!isPackageName(input.name)) {
    throw new Error(`Invalid node-boost plugin package name: ${String(input.name)}.`);
  }
  if (!Array.isArray(input.architectures) || input.architectures.length === 0) {
    throw new Error("Invalid node-boost plugin: architectures must contain at least one item.");
  }

  const slugs = new Set<string>();
  for (const architecture of input.architectures) {
    validateArchitecture(architecture, input.name, slugs);
  }

  return deepFreeze(input);
}

function validateArchitecture(
  architecture: NodeBoostPluginArchitecture,
  packageName: string,
  slugs: Set<string>,
): void {
  validateExactKeys(architecture, ["description", "resources", "slug", "stacks", "title"], "architecture");
  if (!isSlug(architecture.slug)) {
    throw new Error(`Invalid node-boost architecture slug: ${String(architecture.slug)}.`);
  }
  if (slugs.has(architecture.slug)) {
    throw new Error(`Duplicate node-boost architecture: ${packageName}:${architecture.slug}.`);
  }
  slugs.add(architecture.slug);

  if (typeof architecture.title !== "string" || architecture.title.trim().length === 0) {
    throw new Error(`Invalid node-boost architecture ${architecture.slug}: title is required.`);
  }
  if (architecture.description !== undefined && typeof architecture.description !== "string") {
    throw new Error(`Invalid node-boost architecture ${architecture.slug}: description must be a string.`);
  }
  if (!Array.isArray(architecture.stacks) || architecture.stacks.length === 0) {
    throw new Error(`Invalid node-boost architecture ${architecture.slug}: stacks must not be empty.`);
  }

  const stackNames = new Set<NodeBoostPluginStack>();
  for (const stack of architecture.stacks) {
    if (stack !== "next" && stack !== "vite-react" && stack !== "react-generic") {
      throw new Error(`Invalid node-boost architecture ${architecture.slug}: unsupported stack ${String(stack)}.`);
    }
    if (stackNames.has(stack)) {
      throw new Error(`Invalid node-boost architecture ${architecture.slug}: duplicate stack ${stack}.`);
    }
    stackNames.add(stack);
  }

  validateResources(architecture.resources, architecture.slug);
}

function validateResources(resources: NodeBoostPluginResources, architectureSlug: string): void {
  validateExactKeys(resources, ["guideline", "skill", "variants"], `architecture ${architectureSlug} resources`);
  validateResourcePath(resources.guideline, `${architectureSlug} guideline`);
  validateResourcePath(resources.skill, `${architectureSlug} skill`);

  if (resources.variants === undefined) {
    return;
  }
  if (!isRecord(resources.variants)) {
    throw new Error(`Invalid node-boost architecture ${architectureSlug}: variants must be an object.`);
  }

  for (const [variant, variantResources] of Object.entries(resources.variants)) {
    if (!isSlug(variant)) {
      throw new Error(`Invalid node-boost variant slug: ${variant}.`);
    }
    validateExactKeys(variantResources, ["guideline", "skill"], `variant ${variant}`);
    if (variantResources.guideline === undefined && variantResources.skill === undefined) {
      throw new Error(`Invalid node-boost variant ${variant}: at least one resource override is required.`);
    }
    if (variantResources.guideline !== undefined && typeof variantResources.guideline !== "string") {
      throw new Error(`Invalid node-boost variant ${variant}: guideline must be a string.`);
    }
    if (variantResources.skill !== undefined && typeof variantResources.skill !== "string") {
      throw new Error(`Invalid node-boost variant ${variant}: skill must be a string.`);
    }
    if (typeof variantResources.guideline === "string") {
      validateResourcePath(variantResources.guideline, `${variant} guideline`);
    }
    if (typeof variantResources.skill === "string") {
      validateResourcePath(variantResources.skill, `${variant} skill`);
    }
  }
}

function validateResourcePath(path: string, label: string): void {
  if (typeof path !== "string" || path.length === 0 || path.startsWith("/") || path.startsWith("\\")) {
    throw new Error(`Invalid node-boost plugin ${label} path: expected a relative Markdown path.`);
  }

  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..") || !normalized.endsWith(".md")) {
    throw new Error(`Invalid node-boost plugin ${label} path: ${path}.`);
  }
}

function validateExactKeys(value: unknown, allowed: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid node-boost ${label}: expected an object.`);
  }
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    throw new Error(`Invalid node-boost ${label}: unsupported field(s): ${unknown.sort().join(", ")}.`);
  }
}

function isPackageName(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0 || name.length > 214 || name !== name.toLowerCase()) {
    return false;
  }
  if (name.startsWith("@")) {
    const parts = name.slice(1).split("/");
    return parts.length === 2 && parts.every(isPackageSegment);
  }
  return !name.includes("/") && isPackageSegment(name);
}

function isPackageSegment(segment: string): boolean {
  return segment.length > 0
    && isLowerAlphaNumeric(segment[0])
    && [...segment].every((character) => isLowerAlphaNumeric(character) || "-._~".includes(character));
}

function isSlug(value: unknown): boolean {
  return typeof value === "string"
    && value.length > 0
    && isLowerAlphaNumeric(value[0])
    && isLowerAlphaNumeric(value.at(-1))
    && [...value].every((character) => isLowerAlphaNumeric(character) || character === "-");
}

function isLowerAlphaNumeric(character: string | undefined): boolean {
  return character !== undefined && ((character >= "a" && character <= "z") || (character >= "0" && character <= "9"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}
