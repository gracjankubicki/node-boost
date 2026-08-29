import type { DetectedStack, StackAdapter } from "../types.js";
import { astroStackAdapter } from "./astro.js";
import { nextStackAdapter } from "./next.js";
import { viteReactStackAdapter } from "./vite-react.js";

export const stackAdapters: StackAdapter[] = [nextStackAdapter, viteReactStackAdapter, astroStackAdapter];

export function getStackAdapter(stack: DetectedStack): StackAdapter | null {
  return stackAdapters.find((adapter) => adapter.supports(stack)) ?? null;
}

export function hasPackage(stack: DetectedStack, packageName: string): boolean {
  return Boolean(stack.packages[packageName]?.version);
}
