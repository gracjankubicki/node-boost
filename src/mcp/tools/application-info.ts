import { version as nodeVersion } from "node:process";
import { detectStack } from "../../detect/stack.js";
import type { PackageInfo } from "../../types.js";
import { readBoostConfig, readTypescriptStrict } from "../project.js";

export interface ApplicationInfo {
  node: string;
  packageManager: string;
  typescript: {
    version: string | null;
    strict: boolean | null;
  };
  stack: {
    name: string;
    version: string | null;
    router: string;
    srcDir: boolean;
  };
  linting: string;
  capabilities: {
    reactCompiler: boolean;
    nextCacheComponents: boolean;
  };
  packages: Record<string, string>;
  boost: {
    version: string;
    generatedWith: string;
    architectures: Array<{ name: string; options: Record<string, unknown> }>;
  } | null;
  hint?: string;
}

export async function applicationInfoTool(rootDir: string, boostVersion: string): Promise<ApplicationInfo> {
  const stack = await detectStack(rootDir);
  const boostConfig = await readBoostConfig(rootDir);

  return {
    node: nodeVersion.replace(/^v/, ""),
    packageManager: `${stack.packageManager.name}${stack.packageManager.version ? `@${stack.packageManager.version}` : ""}`,
    typescript: {
      version: stack.packages.typescript?.version ?? null,
      strict: await readTypescriptStrict(rootDir),
    },
    stack: {
      name: stack.name,
      version: stackVersion(stack.packages),
      router: stack.router,
      srcDir: stack.srcDir,
    },
    linting: stack.linting,
    capabilities: stack.capabilities,
    packages: detectedPackages(stack.packages),
    boost: boostConfig.config
      ? {
          version: boostVersion,
          generatedWith: boostConfig.config.generatedWith,
          architectures: boostConfig.architectures.map((architecture) => ({
            name: architecture.name,
            options: architecture.options,
          })),
        }
      : null,
    ...(boostConfig.config ? {} : { hint: "run node-boost install" }),
  };
}

function detectedPackages(packages: Record<string, PackageInfo>): Record<string, string> {
  return Object.fromEntries(
    Object.values(packages)
      .filter((pkg) => pkg.source !== "missing" && pkg.version)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pkg) => [pkg.name, pkg.version as string]),
  );
}

function stackVersion(packages: Record<string, PackageInfo>): string | null {
  return packages.next?.version ?? packages.vite?.version ?? packages.react?.version ?? null;
}
