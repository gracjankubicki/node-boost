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

const isNext163 = (stack: DetectedStack) => {
  if (stack.name !== "next") return false;
  const match = stack.packages.next?.version?.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return false;
  const [, major, minor] = match.map(Number);
  return major > 16 || (major === 16 && minor >= 3);
};
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
  ].map((name) => ({ name, source: nextSkillsSource, upstreamDirectory: name, appliesTo: isNext163 })),
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
        if (!files.includes(join(skillDir, "SKILL.md"))) {
          throw new Error(`Missing vendored SKILL.md: ${skillDir}`);
        }
        if (files.includes(join(skillDir, "LICENSE.md"))) {
          throw new Error(`Vendored LICENSE.md conflicts with the generated notice: ${skillDir}`);
        }
        // Keep the upstream notice with every standalone copy installed in a consumer.
        files.push(join(rootDir, "resources", "vendor", "VERCEL-LICENSE.md"));
        return files.map((file) => {
          const isNotice = file === join(rootDir, "resources", "vendor", "VERCEL-LICENSE.md");
          const relativePath = isNotice ? "LICENSE.md" : relative(skillDir, file).replaceAll("\\", "/");
          return {
            kind: "skill",
            sourcePath: isNotice ? join("resources", "vendor", "VERCEL-LICENSE.md") : join(vendorSkillsRoot, skill.name, relativePath),
            outputPath: posix.join(".ai", "skills", skill.name, relativePath),
          } satisfies ResourceSelection;
        });
      }),
  );
  return selections.flat();
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

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
