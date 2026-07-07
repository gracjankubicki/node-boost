import { access } from "node:fs/promises";
import { join } from "node:path";
import type { RouterKind } from "../types.js";

export interface NextRouterDetection {
  router: RouterKind;
  srcDir: boolean;
}

export async function detectNextRouter(rootDir: string): Promise<NextRouterDetection> {
  const hasRootApp = await directoryExists(join(rootDir, "app"));
  const hasSrcApp = await directoryExists(join(rootDir, "src", "app"));
  const hasRootPages = await directoryExists(join(rootDir, "pages"));
  const hasSrcPages = await directoryExists(join(rootDir, "src", "pages"));

  if (hasRootApp || hasSrcApp) {
    return { router: "app", srcDir: hasSrcApp };
  }

  if (hasRootPages || hasSrcPages) {
    return { router: "pages", srcDir: hasSrcPages };
  }

  return { router: "unknown", srcDir: false };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
