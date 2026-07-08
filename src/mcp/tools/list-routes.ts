import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { detectStack } from "../../detect/stack.js";

export type RouteType = "page" | "layout" | "route-handler" | "error" | "loading" | "not-found" | "middleware" | "api-route";

export interface RouteEntry {
  path: string;
  type: RouteType;
  file: string;
  dynamic: string[];
  slot?: string;
}

export interface UnsupportedRoutes {
  supported: false;
  reason: string;
}

const appRouteFiles: Record<string, RouteType> = {
  page: "page",
  layout: "layout",
  route: "route-handler",
  error: "error",
  loading: "loading",
  "not-found": "not-found",
  middleware: "middleware",
};

const supportedExtensions = new Set(["js", "jsx", "ts", "tsx", "mdx"]);

export async function listRoutesTool(rootDir: string): Promise<RouteEntry[] | UnsupportedRoutes> {
  const stack = await detectStack(rootDir);

  if (stack.name === "vite-react") {
    return {
      supported: false,
      reason: "react-router route map is on the roadmap",
    };
  }

  if (stack.name !== "next") {
    return [];
  }

  if (stack.router === "app") {
    return sortRoutes([
      ...(await scanAppRouter(rootDir, join(rootDir, "app"))),
      ...(await scanAppRouter(rootDir, join(rootDir, "src", "app"))),
    ]);
  }

  if (stack.router === "pages") {
    return sortRoutes([
      ...(await scanPagesRouter(rootDir, join(rootDir, "pages"))),
      ...(await scanPagesRouter(rootDir, join(rootDir, "src", "pages"))),
    ]);
  }

  return [];
}

async function scanAppRouter(rootDir: string, dir: string): Promise<RouteEntry[]> {
  const files = await walkFiles(dir);

  return files.flatMap((file) => {
    const parsed = parseRouteFile(file);
    if (!parsed || !appRouteFiles[parsed.basename]) {
      return [];
    }

    const appRelative = relative(dir, file);
    const routeSegments = appRelative.split(sep).slice(0, -1);
    const slot = routeSegments.find((segment) => segment.startsWith("@"))?.slice(1);
    const path = segmentsToPath(routeSegments);

    return [
      {
        path,
        type: appRouteFiles[parsed.basename],
        file: normalizePath(relative(rootDir, file)),
        dynamic: extractDynamicSegments(routeSegments),
        ...(slot ? { slot } : {}),
      },
    ];
  });
}

async function scanPagesRouter(rootDir: string, dir: string): Promise<RouteEntry[]> {
  const files = await walkFiles(dir);

  return files.flatMap((file) => {
    const parsed = parseRouteFile(file);
    if (!parsed || parsed.basename.startsWith("_") || parsed.basename === "middleware") {
      return [];
    }

    const pagesRelative = relative(dir, file);
    const pathWithoutExtension = pagesRelative.slice(0, -parsed.extension.length - 1);
    const segments = pathWithoutExtension.split(sep);
    const isApi = segments[0] === "api";
    const routeSegments = isApi ? segments.slice(1) : segments;

    if (routeSegments[routeSegments.length - 1] === "index") {
      routeSegments.pop();
    }

    return [
      {
        path: isApi ? `/api${segmentsToPath(routeSegments) === "/" ? "" : segmentsToPath(routeSegments)}` : segmentsToPath(routeSegments),
        type: isApi ? "api-route" : "page",
        file: normalizePath(relative(rootDir, file)),
        dynamic: extractDynamicSegments(routeSegments),
      },
    ];
  });
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
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(path);
      }

      return entry.isFile() ? [path] : [];
    }),
  );

  return files.flat();
}

function parseRouteFile(file: string): { basename: string; extension: string } | null {
  const filename = file.split(sep).at(-1) ?? "";
  const parts = filename.split(".");

  if (parts.length < 2) {
    return null;
  }

  const extension = parts.at(-1) ?? "";
  const basename = parts.slice(0, -1).join(".");

  if (!supportedExtensions.has(extension)) {
    return null;
  }

  return { basename, extension };
}

function segmentsToPath(segments: string[]): string {
  const routeSegments = segments.filter((segment) => !segment.startsWith("(") && !segment.startsWith("@"));
  return `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
}

function extractDynamicSegments(segments: string[]): string[] {
  return segments
    .map((segment) => segment.match(/^\[\[?\.{0,3}([^\]]+)\]?\]$/)?.[1] ?? null)
    .filter((segment): segment is string => Boolean(segment));
}

function sortRoutes(routes: RouteEntry[]): RouteEntry[] {
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.type.localeCompare(b.type) || a.file.localeCompare(b.file));
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}
