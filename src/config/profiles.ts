import type { ArchitectureConfigEntry, DetectedStack, StackName } from "../types.js";

export const profileNames = ["static-content-site", "server-app", "spa"] as const;
export type ProjectProfile = typeof profileNames[number];

export function suggestedProfile(stack: DetectedStack): ProjectProfile | undefined {
  if (stack.rendering?.unknown || stack.warnings.some((warning) => warning.includes("config is dynamic"))) return undefined;
  if (stack.name === "vite-react") return stack.rendering?.ssr ? undefined : "spa";
  if (stack.name === "next") return stack.rendering?.output === "export" ? "static-content-site" : "server-app";
  if (stack.name === "astro") return stack.astro?.output === "static" && !stack.astro.adapter && !stack.astro.actions && stack.astro.rendering === "static-first" ? "static-content-site" : "server-app";
  return undefined;
}

export function profileSupportsStack(profile: ProjectProfile, stack: StackName): boolean {
  return profile === "spa" ? stack === "vite-react" : stack === "astro" || stack === "next";
}

export function profileArchitectures(profile: ProjectProfile, stack: StackName): ArchitectureConfigEntry[] {
  const common: ArchitectureConfigEntry[] = ["secure-by-default", "typed-contracts", "testing-strategy", "modern-typescript"];
  if (profile === "spa") return [...common, "feature-modules", "data-access-layer", "state-management", "component-composition", "ui-states"];
  if (stack === "astro") return [...common, "content-modeling", "islands-architecture",
    { name: "rendering-strategy", variant: profile === "static-content-site" ? "static-first" : "server-first" },
    ...(profile === "server-app" ? ["request-boundaries" as const] : [])];
  return [...common, "server-first-components", "data-access-layer", "component-composition",
    ...(profile === "server-app" ? ["error-loading-boundaries" as const] : [])];
}

export function profileGuidance(profile: ProjectProfile): string {
  const contract = profile === "static-content-site"
    ? "Build a static result. Browser interactivity and forms sent to an external backend are allowed. Do not add a server adapter, Actions, server islands, or request-time routes. Next.js must use output: 'export'."
    : profile === "server-app"
      ? "Server request handling is allowed. Static pages and static exports are also allowed; do not convert every route to server rendering. Keep request data isolated and validate runtime boundaries."
      : "Run the application in the browser. External APIs are allowed. Do not add your own server rendering or server endpoints.";
  return `# Declared project profile: ${profile}\n\n${contract}\n\nThis is user-owned intent, not a detected fact. Read node-boost.json before changing architecture. Preserve explicit architecture selections. The profile does not generate application code.\n`;
}
