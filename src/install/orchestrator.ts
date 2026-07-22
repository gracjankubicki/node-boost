import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { ZodError } from "zod";
import { agentInstallers } from "../agents/index.js";
import { createHookCommand, createMcpCommand, type FileOperation } from "../agents/agent.js";
import { removeManagedBlock } from "../agents/managed-block.js";
import { removeMcpJson } from "../agents/merge-json.js";
import { removeCodexMcpToml } from "../agents/merge-toml.js";
import { removeClaudeCodeHooks, removeCodexHooks, removeCursorHooks } from "../agents/merge-hooks.js";
import { applyResourceOverrides } from "../compose/overrides.js";
import { composeGuidelines } from "../compose/guidelines.js";
import { composeSkills } from "../compose/skills.js";
import { renderGuidelinesIndex } from "../compose/index-file.js";
import { renderLibraryDocumentationLlmsTxt } from "../compose/library-docs.js";
import {
  nodeBoostConfigSchema,
  normalizeArchitectures,
  parseNodeBoostConfig,
  type NodeBoostConfig,
} from "../config/schema.js";
import { detectStack } from "../detect/stack.js";
import { loadNodeBoostPlugins, pluginResourceSelections, resolvePluginArchitectures } from "../plugin/runtime.js";
import { getStackAdapter } from "../stacks/adapter.js";
import type { AgentName, ArchitectureConfigEntry, ArchitectureSlug, DetectedStack, FeatureName, ResourceSelection } from "../types.js";
import { findNearestPackageRoot, isWorkspaceRoot, pathExists, readPackageJson, resolveDefaultPackageRoot } from "./project.js";
import {
  generatedManifestPath,
  hashGeneratedContent,
  isOwnedGeneratedPath,
  readGeneratedManifest,
  renderGeneratedManifest,
  type GeneratedFileRecord,
} from "./generated-manifest.js";

const allAgents = ["claude-code", "codex", "cursor"] satisfies AgentName[];
const defaultFeatures = {
  guidelines: true,
  skills: true,
  mcp: true,
  architecture: true,
  hooks: false,
};
const localSchemaPath = "./.ai/node-boost.schema.json";

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
  status: "created" | "updated" | "skipped" | "deleted" | "conflict";
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
  const applied = await applyFileOperations(projectRoot, operations, config.generatedWith);

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
  const previousConfig = parseConfigWithReadableErrors(JSON.parse(rawConfig));
  const config = nodeBoostConfigSchema.parse({
    ...previousConfig,
    $schema: localSchemaPath,
    generatedWith: await readPackageVersion(packageRoot),
  });
  const operations = await buildInstallOperations({ packageRoot, projectRoot, stack, config });

  return {
    projectRoot,
    stack,
    config,
    operations: await applyFileOperations(projectRoot, operations, config.generatedWith),
  };
}

export async function buildInstallOperations(input: {
  packageRoot: string;
  projectRoot: string;
  stack: DetectedStack;
  config: NodeBoostConfig;
}): Promise<FileOperation[]> {
  const architectures = input.config.features.architecture ? normalizeArchitectures(input.config) : [];
  const plugins = await loadNodeBoostPlugins(input.projectRoot, input.config.plugins ?? []);
  const pluginArchitectures = resolvePluginArchitectures(plugins, architectures, input.stack.name);
  const builtInArchitectures = architectures.filter((architecture) => !architecture.name.includes(":"));
  const pluginResources = pluginResourceSelections(pluginArchitectures);
  const selectedGuidelines = input.config.features.guidelines
    ? await applyResourceOverrides(input.projectRoot, [
      ...await composeGuidelines(input.packageRoot, input.stack, builtInArchitectures),
      ...pluginResources.guidelines,
    ])
    : [];
  const selectedSkills = input.config.features.skills
    ? await applyResourceOverrides(input.projectRoot, [
      ...await composeSkills(input.packageRoot, input.stack, builtInArchitectures),
      ...pluginResources.skills,
    ])
    : [];

  const guidelineOperations = await readResourceOperations(input.packageRoot, selectedGuidelines);
  const skillOperations = await readResourceOperations(input.packageRoot, selectedSkills);
  const schemaOperation = {
    path: ".ai/node-boost.schema.json",
    content: await readSource(input.packageRoot, "schema.json"),
  };
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
  const hookAgents = new Set(input.config.hookAgents ?? input.config.agents);
  const agentOperations = input.config.agents.flatMap((agentName) =>
    agentInstallers[agentName]
      .render({
        guidelinesIndexPath: ".ai/guidelines/node-boost.md",
        libraryDocsPath: ".ai/docs/llms.txt",
        skillsIndexPath: ".ai/skills",
        selectedSkills,
        existingContent: (path) => shouldReadIntegrationContent(path, input.config.features, agentName, hookAgents)
          ? existingContent.get(path) ?? null
          : null,
        skillContentByOutputPath,
        mcpCommand,
        hookCommands,
      })
      .filter((operation) => keepOperationForFeatures(operation.path, input.config.features, agentName, hookAgents)),
  );
  const cleanupOperations = buildIntegrationCleanupOperations(existingContent, input.config, hookAgents);

  return dedupeOperations([
    schemaOperation,
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
    ...cleanupOperations,
    {
      path: "node-boost.json",
      content: `${JSON.stringify(input.config, null, 2)}\n`,
    },
  ]);
}

function shouldReadIntegrationContent(
  path: string,
  features: NodeBoostConfig["features"],
  agent: AgentName,
  hookAgents: ReadonlySet<AgentName>,
): boolean {
  if ((path === ".mcp.json" || path === ".codex/config.toml" || path === ".cursor/mcp.json") && !features.mcp) {
    return false;
  }
  if (
    (path === ".claude/settings.json" || path === ".codex/hooks.json" || path === ".cursor/hooks.json")
    && (!features.hooks || !hookAgents.has(agent))
  ) {
    return false;
  }
  return true;
}

function buildIntegrationCleanupOperations(
  existingContent: Map<string, string | null>,
  config: NodeBoostConfig,
  hookAgents: ReadonlySet<AgentName>,
): FileOperation[] {
  const selectedAgents = new Set(config.agents);
  const guidanceEnabled = config.features.guidelines || config.features.skills;
  const candidates: FileOperation[] = [];
  const cleanup = (path: string, remove: (content: string | null) => string | null): void => {
    const existing = existingContent.get(path) ?? null;
    if (existing === null) {
      return;
    }

    try {
      const content = remove(existing);
      if (content !== null && content !== existing) {
        candidates.push({ path, content });
      }
    } catch {
      // A disabled integration must not parse or rewrite a malformed foreign file.
    }
  };

  if (!selectedAgents.has("claude-code") || !guidanceEnabled) {
    cleanup("CLAUDE.md", removeManagedBlock);
  }
  if (!selectedAgents.has("codex") || !guidanceEnabled) {
    cleanup("AGENTS.md", removeManagedBlock);
  }
  if (!selectedAgents.has("claude-code") || !config.features.mcp) {
    cleanup(".mcp.json", removeMcpJson);
  }
  if (!selectedAgents.has("codex") || !config.features.mcp) {
    cleanup(".codex/config.toml", removeCodexMcpToml);
  }
  if (!selectedAgents.has("cursor") || !config.features.mcp) {
    cleanup(".cursor/mcp.json", removeMcpJson);
  }
  if (!selectedAgents.has("claude-code") || !config.features.hooks || !hookAgents.has("claude-code")) {
    cleanup(".claude/settings.json", removeClaudeCodeHooks);
  }
  if (!selectedAgents.has("codex") || !config.features.hooks || !hookAgents.has("codex")) {
    cleanup(".codex/hooks.json", removeCodexHooks);
  }
  if (!selectedAgents.has("cursor") || !config.features.hooks || !hookAgents.has("cursor")) {
    cleanup(".cursor/hooks.json", removeCursorHooks);
  }

  return candidates;
}

export async function applyFileOperations(
  projectRoot: string,
  operations: FileOperation[],
  generatedWith = "unknown",
): Promise<FileOperationResult[]> {
  const results: FileOperationResult[] = [];
  const previousManifest = await readGeneratedManifest(projectRoot);
  const previousFiles = new Map((previousManifest?.files ?? []).map((file) => [file.path, file]));
  const configOperation = operations.find((operation) => operation.path === "node-boost.json");
  const desiredOwned = new Map(
    operations.filter((operation) => isOwnedGeneratedPath(operation.path)).map((operation) => [operation.path, operation]),
  );
  const nextFiles = new Map<string, GeneratedFileRecord>();

  for (const previous of previousFiles.values()) {
    if (desiredOwned.has(previous.path)) {
      continue;
    }

    const target = join(projectRoot, previous.path);
    const current = await readOptional(target);
    if (current === null) {
      continue;
    }

    if (hashGeneratedContent(current) === previous.sha256) {
      await rm(target);
      await pruneEmptyDirectories(dirname(target), projectRoot);
      results.push({ path: previous.path, content: current, status: "deleted" });
    } else {
      nextFiles.set(previous.path, previous);
      results.push({ path: previous.path, content: current, status: "conflict" });
    }
  }

  for (const operation of operations) {
    if (operation.path === "node-boost.json") {
      continue;
    }

    const target = join(projectRoot, operation.path);
    const previous = await readOptional(target);
    const previousRecord = previousFiles.get(operation.path);
    const desiredHash = hashGeneratedContent(operation.content);
    const modifiedOwned = isOwnedGeneratedPath(operation.path)
      && previous !== null
      && previous !== operation.content
      && (previousRecord ? hashGeneratedContent(previous) !== previousRecord.sha256 : true);

    if (modifiedOwned) {
      if (previousRecord) {
        nextFiles.set(operation.path, previousRecord);
      }
      results.push({ ...operation, status: "conflict" });
      continue;
    }

    const status = previous === null ? "created" : previous === operation.content ? "skipped" : "updated";

    if (status !== "skipped") {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, operation.content, "utf8");
    }

    results.push({ ...operation, status });
    if (isOwnedGeneratedPath(operation.path)) {
      nextFiles.set(operation.path, { path: operation.path, sha256: desiredHash });
    }
  }

  const manifestOperation = {
    path: generatedManifestPath,
    content: renderGeneratedManifest(generatedWith, nextFiles.values()),
  };
  const previousManifestContent = await readOptional(join(projectRoot, generatedManifestPath));
  const manifestStatus = previousManifestContent === null
    ? "created"
    : previousManifestContent === manifestOperation.content
      ? "skipped"
      : "updated";
  if (manifestStatus !== "skipped") {
    await mkdir(dirname(join(projectRoot, generatedManifestPath)), { recursive: true });
    await writeFile(join(projectRoot, generatedManifestPath), manifestOperation.content, "utf8");
  }
  results.push({ ...manifestOperation, status: manifestStatus });

  if (configOperation) {
    const target = join(projectRoot, configOperation.path);
    const previous = await readOptional(target);
    const status = previous === null ? "created" : previous === configOperation.content ? "skipped" : "updated";
    if (status !== "skipped") {
      await writeFile(target, configOperation.content, "utf8");
    }
    results.push({ ...configOperation, status });
  }

  return results.sort((left, right) => left.path.localeCompare(right.path));
}

async function pruneEmptyDirectories(start: string, projectRoot: string): Promise<void> {
  let current = start;
  while (current !== projectRoot && current.startsWith(projectRoot)) {
    try {
      await rmdir(current);
    } catch {
      return;
    }
    current = dirname(current);
  }
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
    $schema: localSchemaPath,
    version: 1,
    generatedWith: await readPackageVersion(packageRoot),
    stack: stack.name,
    agents: allAgents,
    plugins: [],
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

  const hookAgents = featureConfig.hooks
    ? await multiselect<AgentName>({
      message: "Select agents with blocking hooks",
      options: agents.map((agent) => ({ label: agent, value: agent })),
      initialValues: [...agents],
      required: false,
    })
    : [];
  abortIfCancelled(hookAgents);

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
    $schema: localSchemaPath,
    version: 1,
    generatedWith: await readPackageVersion(packageRoot),
    stack: stack.name,
    agents,
    hookAgents,
    plugins: [],
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
  const selected = await multiselect<ArchitectureSlug>({
    message: "Select architecture guidance",
    options: recommended.map((architecture) => ({ label: architecture, value: architecture })),
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

function keepOperationForFeatures(
  path: string,
  features: NodeBoostConfig["features"],
  agent: AgentName,
  hookAgents: ReadonlySet<AgentName>,
): boolean {
  if ((path === ".mcp.json" || path === ".codex/config.toml" || path === ".cursor/mcp.json") && !features.mcp) {
    return false;
  }

  if (
    (path === ".claude/settings.json" || path === ".codex/hooks.json" || path === ".cursor/hooks.json")
    && (!features.hooks || !hookAgents.has(agent))
  ) {
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
    { created: 0, updated: 0, skipped: 0, deleted: 0, conflict: 0 },
  );

  return `created ${counts.created}, updated ${counts.updated}, deleted ${counts.deleted}, conflicts ${counts.conflict}, skipped ${counts.skipped}`;
}
