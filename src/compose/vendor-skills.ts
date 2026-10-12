import { readdir } from "node:fs/promises";
import { join, posix, relative } from "node:path";
import type { DetectedStack, ResourceSelection } from "../types.js";

export const vendorSkillsRoot = join("resources", "vendor", "skills");

export interface VendorSkillSource {
  repository: string;
  directory: string;
}

export interface VendorSkill {
  name: string;
  source: VendorSkillSource;
  upstreamDirectory: string;
  appliesTo: (stack: DetectedStack) => boolean;
}

export const nextSkillsSource: VendorSkillSource = { repository: "https://github.com/vercel/next.js", directory: "skills" };
export const agentSkillsSource: VendorSkillSource = { repository: "https://github.com/vercel-labs/agent-skills", directory: "skills" };

const isNext16 = (stack: DetectedStack) => stack.name === "next" && (stack.packages.next?.major ?? 0) >= 16;
const usesReact = (stack: DetectedStack) => Boolean(stack.packages.react?.version);
const deploysToVercelFramework = (stack: DetectedStack) => stack.name === "next" || stack.name === "astro";

export const vendorSkills: VendorSkill[] = [
  ...[
    "next-dev-loop",
    "next-cache-components-optimizer",
    "next-partial-prefetching-optimizer",
    "next-bundle-optimizer",
    "next-cache-components-adoption",
    "next-partial-prefetching-adoption",
  ].map((name) => ({ name, source: nextSkillsSource, upstreamDirectory: name, appliesTo: isNext16 })),
  { name: "vercel-react-best-practices", source: agentSkillsSource, upstreamDirectory: "react-best-practices", appliesTo: usesReact },
  { name: "vercel-composition-patterns", source: agentSkillsSource, upstreamDirectory: "composition-patterns", appliesTo: usesReact },
  { name: "vercel-react-view-transitions", source: agentSkillsSource, upstreamDirectory: "react-view-transitions", appliesTo: usesReact },
  { name: "web-design-guidelines", source: agentSkillsSource, upstreamDirectory: "web-design-guidelines", appliesTo: () => true },
  { name: "vercel-optimize", source: agentSkillsSource, upstreamDirectory: "vercel-optimize", appliesTo: deploysToVercelFramework },
];

export async function composeVendorSkills(rootDir: string, stack: DetectedStack): Promise<ResourceSelection[]> {
  const selections = await Promise.all(
    vendorSkills
      .filter((skill) => skill.appliesTo(stack))
      .map(async (skill) => {
        const skillDir = join(rootDir, vendorSkillsRoot, skill.name);
        const files = await walkFiles(skillDir);
        return files.map((file) => {
          const relativePath = relative(skillDir, file).replaceAll("\\", "/");
          return {
            kind: "skill",
            sourcePath: join(vendorSkillsRoot, skill.name, relativePath),
            outputPath: posix.join(".ai", "skills", skill.name, relativePath),
          } satisfies ResourceSelection;
        });
      }),
  );
  return selections.flat();
}

async function walkFiles(dir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }
      return entry.isFile() ? [fullPath] : [];
    }),
  );

  return files.flat();
}
