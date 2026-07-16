import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { ZodError } from "zod";
import { agentInstallers } from "../agents/index.js";
import { createHookCommand, createMcpCommand, type FileOperation } from "../agents/agent.js";
import { applyResourceOverrides } from "../compose/overrides.js";
import { composeGuidelines } from "../compose/guidelines.js";
import { renderLibraryDocumentationLlmsTxt } from "../compose/library-docs.js";
import { composeSkills } from "../compose/skills.js";
import { renderGuidelinesIndex } from "../compose/index-file.js";
import {
  nodeBoostConfigSchema,
  normalizeArchitectures,
  parseNodeBoostConfig,
  type NodeBoostConfig,
} from "../config/schema.js";
import { detectStack } from "../detect/stack.js";
import { getStackAdapter } from "../stacks/adapter.js";
import type { AgentName, ArchitectureConfigEntry, ArchitectureSlug, DetectedStack, FeatureName, ResourceSelection } from "../types.js";
import { findNearestPackageRoot, isWorkspaceRoot, pathExists, readPackageJson, resolveDefaultPackageRoot } from "./project.js";

const allAgents = ["claude-code", "codex", "cursor"] satisfies AgentName[];
const defaultFeatures = {
  guidelines: true,
  skills: true,
  mcp: true,
  architecture: true,
  hooks: false,
};

export interface InstallOptions {
  cwd?: string;
  packageRoot?: string;
  noInteraction?: boolean;
}

export interface UpdateOptions {
  cwd?: string;
  packageRoot?: string;
}

export interface FileOperationResult extends FileOperation {
  status: "created" | "updated" | "skipped";
}

export interface InstallResult {
  projectRoot: string;
  stack: DetectedStack;
  config: NodeBoostConfig;
  operations: FileOperationResult[];
}

export async function runInstall(options: InstallOptions = {}): Promise<InstallResult> {
  const cwd = options.cwd ?? process.cwd();
  const packageRoot = options.packageRoot ?? (await resolveDefaultPackageRoot(import.meta.url));
  const projectRoot = await resolveProjectRoot(cwd);
  const stack = await detectStack(projectRoot);
  const config = options.noInteraction
    ? await createDefaultConfig(packageRoot, projectRoot, stack)
    : await promptForConfig(packageRoot, projectRoot, stack);
  const operations = await buildInstallOperations({ packageRoot, projectRoot, stack, config });
  const applied = await applyFileOperations(projectRoot, operations);

  if (!options.noInteraction) {
    outro(renderSummary(applied));
  }

  return {
    projectRoot,
    stack,
    config,
    operations: applied,
  };
}

export async function runUpdate(options: UpdateOptions = {}): Promise<InstallResult> {
  const cwd = options.cwd ?? process.cwd();
  const packageRoot = options.packageRoot ?? (await resolveDefaultPackageRoot(import.meta.url));
  const projectRoot = await resolveProjectRoot(cwd);
  const stack = await detectStack(projectRoot);
  const configPath = join(projectRoot, "node-boost.json");
  const rawConfig = await readFile(configPath, "utf8");
  const config = parseConfigWithReadableErrors(JSON.parse(rawConfig));
  const operations = await buildInstallOperations({ packageRoot, projectRoot, stack, config });

  return {
    projectRoot,
    stack,
    config,
    operations: await applyFileOperations(projectRoot, operations),
  };
}

export async function buildInstallOperations(input: {
  packageRoot: string;
  projectRoot: string;
  stack: DetectedStack;
  config: NodeBoostConfig;
}): Promise<FileOperation[]> {
  const architectures = input.config.features.architecture ? normalizeArchitectures(input.config) : [];
  const selectedGuidelines = input.config.features.guidelines
    ? await applyResourceOverrides(input.projectRoot, await composeGuidelines(input.packageRoot, input.stack, architectures))
    : [];
  const selectedSkills = input.config.features.skills
    ? await applyResourceOverrides(input.projectRoot, await composeSkills(input.packageRoot, input.stack, architectures))
    : [];

  const guidelineOperations = await readResourceOperations(input.packageRoot, selectedGuidelines);
  const skillOperations = await readResourceOperations(input.packageRoot, selectedSkills);
  const skillContentByOutputPath = new Map(skillOperations.map((operation) => [operation.path, operation.content]));
  const existingContent = await preloadExisting(input.projectRoot, [
    "CLAUDE.md",
    "AGENTS.md",
    ".mcp.json",
    ".claude/settings.json",
    ".codex/hooks.json",
    ".codex/config.toml",
    ".cursor/hooks.json",
    ".cursor/mcp.json",
  ]);

  const mcpCommand = createMcpCommand(input.stack.packageManager.name);
  const hookCommands = {
    "claude-code": createHookCommand(input.stack.packageManager.name, "claude-code"),
    codex: createHookCommand(input.stack.packageManager.name, "codex"),
    cursor: createHookCommand(input.stack.packageManager.name, "cursor"),
  };
  const agentOperations = input.config.agents.flatMap((agentName) =>
    agentInstallers[agentName]
      .render({
        guidelinesIndexPath: ".ai/guidelines/node-boost.md",
        libraryDocsPath: ".ai/docs/llms.txt",
        skillsIndexPath: ".ai/skills",
        selectedSkills,
        existingContent: (path) => existingContent.get(path) ?? null,
        skillContentByOutputPath,
        mcpCommand,
        hookCommands,
      })
      .filter((operation) => keepOperationForFeatures(operation.path, input.config.features)),
  );

  return dedupeOperations([
    {
      path: ".ai/docs/llms.txt",
      content: renderLibraryDocumentationLlmsTxt(input.stack),
    },
    ...guidelineOperations,
    {
      path: ".ai/guidelines/node-boost.md",
      content: renderGuidelinesIndex(input.stack, architectures, selectedGuidelines),
    },
    ...skillOperations,
    ...agentOperations,
    {
      path: "node-boost.json",
      content: `${JSON.stringify(input.config, null, 2)}\n`,
    },
  ]);
}

export async function applyFileOperations(projectRoot: string, operations: FileOperation[]): Promise<FileOperationResult[]> {
  const results: FileOperationResult[] = [];

  for (const operation of operations) {
    const target = join(projectRoot, operation.path);
    const previous = await readOptional(target);
    const status = previous === null ? "created" : previous === operation.content ? "skipped" : "updated";

    if (status !== "skipped") {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, operation.content, "utf8");
    }

    results.push({ ...operation, status });
  }

  return results;
}

async function resolveProjectRoot(cwd: string): Promise<string> {
  const projectRoot = await findNearestPackageRoot(cwd);

  if (!projectRoot) {
    throw new Error("No package.json found. Run node-boost inside a Node project.");
  }

  const stack = await detectStack(projectRoot);
  if (stack.name === "unknown" && (await isWorkspaceRoot(projectRoot))) {
    throw new Error("Workspace root has no detectable React stack. Run node-boost in an app directory, for example apps/web.");
  }

  return projectRoot;
}

async function createDefaultConfig(packageRoot: string, projectRoot: string, stack: DetectedStack): Promise<NodeBoostConfig> {
  return nodeBoostConfigSchema.parse({
    $schema: "./schema.json",
    version: 1,
    generatedWith: await readPackageVersion(packageRoot),
    stack: stack.name,
    agents: allAgents,
    features: defaultFeatures,
    architectures: await defaultArchitectures(projectRoot, stack),
    audit: {
      exclude: [],
      rules: {},
      ruleOptions: {},
    },
  });
}

async function promptForConfig(packageRoot: string, projectRoot: string, stack: DetectedStack): Promise<NodeBoostConfig> {
  intro(`node-boost install: ${stack.name} / ${stack.packageManager.name}`);

  const agents = await multiselect<AgentName>({
    message: "Select agents",
    options: allAgents.map((agent) => ({ label: agent, value: agent })),
    initialValues: [...allAgents],
    required: true,
  });
  abortIfCancelled(agents);

  const features = await multiselect<FeatureName>({
    message: "Select features",
    options: [
      { label: "Guidelines", value: "guidelines" },
      { label: "Skills", value: "skills" },
      { label: "MCP config", value: "mcp" },
      { label: "Architecture guidance", value: "architecture" },
      { label: "Hooks config flag", value: "hooks" },
    ],
    initialValues: ["guidelines", "skills", "mcp", "architecture"],
    required: true,
  });
  abortIfCancelled(features);

  const featureConfig = {
    guidelines: features.includes("guidelines"),
    skills: features.includes("skills"),
    mcp: features.includes("mcp"),
    architecture: features.includes("architecture"),
    hooks: features.includes("hooks"),
  };

  const architectures = featureConfig.architecture
    ? await promptArchitectures(projectRoot, stack)
    : [];

  const confirmed = await confirm({
    message: "Write node-boost files?",
    initialValue: true,
  });
  abortIfCancelled(confirmed);

  if (!confirmed) {
    cancel("Install cancelled.");
    process.exitCode = 1;
    throw new Error("Install cancelled.");
  }

  return nodeBoostConfigSchema.parse({
    $schema: "./schema.json",
    version: 1,
    generatedWith: await readPackageVersion(packageRoot),
    stack: stack.name,
    agents,
    features: featureConfig,
    architectures,
    audit: {
      exclude: [],
      rules: {},
      ruleOptions: {},
    },
  });
}

async function promptArchitectures(projectRoot: string, stack: DetectedStack): Promise<ArchitectureConfigEntry[]> {
  const adapter = getStackAdapter(stack);
  const recommended = adapter?.recommendedArchitectures(stack) ?? [];
  const applicable = adapter?.applicableArchitectures(stack) ?? [];
  const selected = await multiselect<ArchitectureSlug>({
    message: "Select architecture guidance",
    options: applicable.map((architecture) => ({ label: architecture, value: architecture })),
    initialValues: recommended,
    required: false,
  });
  abortIfCancelled(selected);

  if (!selected.includes("feature-modules")) {
    return selected;
  }

  const suggestedBoundary = await suggestFeatureModulesBoundary(projectRoot);
  const boundary = await select({
    message: "Feature modules boundary",
    options: [
      { label: "Public API imports", value: "public-api", hint: "Use when features already import from each other." },
      { label: "Forbid cross-feature imports", value: "forbid", hint: "Use for greenfield or clean module boundaries." },
    ],
    initialValue: suggestedBoundary,
  });
  abortIfCancelled(boundary);

  return selected.map((architecture) =>
    architecture === "feature-modules" ? { name: "feature-modules", boundary } : architecture,
  );
}

async function defaultArchitectures(projectRoot: string, stack: DetectedStack): Promise<ArchitectureConfigEntry[]> {
  const adapter = getStackAdapter(stack);
  const architectures = adapter?.recommendedArchitectures(stack) ?? [];
  const hasFeatureModules =
    (await pathExists(join(projectRoot, "features"))) || (await pathExists(join(projectRoot, "src", "features")));

  if (hasFeatureModules && adapter?.applicableArchitectures(stack).includes("feature-modules")) {
    architectures.push("feature-modules");
  }

  const featureModulesBoundary = await suggestFeatureModulesBoundary(projectRoot);

  return [...new Set(architectures)].map((architecture) =>
    architecture === "feature-modules" ? { name: "feature-modules", boundary: featureModulesBoundary } : architecture,
  );
}

async function suggestFeatureModulesBoundary(projectRoot: string): Promise<"public-api" | "forbid"> {
  return (await pathExists(join(projectRoot, "features"))) || (await pathExists(join(projectRoot, "src", "features")))
    ? "public-api"
    : "forbid";
}

async function readResourceOperations(packageRoot: string, resources: ResourceSelection[]): Promise<FileOperation[]> {
  return Promise.all(
    resources.map(async (resource) => ({
      path: resource.outputPath,
      content: await readSource(packageRoot, resource.sourcePath),
    })),
  );
}

async function readSource(packageRoot: string, sourcePath: string): Promise<string> {
  const raw = await readFile(isAbsolute(sourcePath) ? sourcePath : join(packageRoot, sourcePath), "utf8");
  return raw.endsWith("\n") ? raw : `${raw}\n`;
}

async function preloadExisting(projectRoot: string, paths: string[]): Promise<Map<string, string | null>> {
  const entries = await Promise.all(paths.map(async (path) => [path, await readOptional(join(projectRoot, path))] as const));
  return new Map(entries);
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function readPackageVersion(packageRoot: string): Promise<string> {
  const packageJson = await readPackageJson(packageRoot);
  return packageJson.version ?? "0.0.0";
}

function keepOperationForFeatures(path: string, features: NodeBoostConfig["features"]): boolean {
  if ((path === ".mcp.json" || path === ".codex/config.toml" || path === ".cursor/mcp.json") && !features.mcp) {
    return false;
  }

  if ((path === ".claude/settings.json" || path === ".codex/hooks.json" || path === ".cursor/hooks.json") && !features.hooks) {
    return false;
  }

  if ((path.startsWith(".claude/skills/") || path.startsWith(".agents/skills/")) && !features.skills) {
    return false;
  }

  if ((path === "CLAUDE.md" || path === "AGENTS.md" || path === ".cursor/rules/node-boost.mdc") && !features.guidelines && !features.skills) {
    return false;
  }

  return true;
}

function dedupeOperations(operations: FileOperation[]): FileOperation[] {
  return [...new Map(operations.map((operation) => [operation.path, operation])).values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

function parseConfigWithReadableErrors(input: unknown): NodeBoostConfig {
  try {
    return parseNodeBoostConfig(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("\n");
      throw new Error(`Invalid node-boost.json:\n${issues}`, { cause: error });
    }

    throw error;
  }
}

function abortIfCancelled<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel("Install cancelled.");
    process.exitCode = 1;
    throw new Error("Install cancelled.");
  }
}

function renderSummary(results: FileOperationResult[]): string {
  const counts = results.reduce(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    { created: 0, updated: 0, skipped: 0 },
  );

  return `created ${counts.created}, updated ${counts.updated}, skipped ${counts.skipped}`;
}
