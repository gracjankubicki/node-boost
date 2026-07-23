import type { DetectedStack, PackageInfo } from "../types.js";

export type DocumentationVersionScope = "exact" | "major" | "current" | "package";

export interface LibraryDocumentationEntry {
  packageName: string;
  version: string;
  declaredRange: string | null;
  versionSource: "installed" | "declared-range";
  preferredUrl: string;
  preferredScope: DocumentationVersionScope;
  officialDocsUrl: string | null;
  officialDocsScope: Exclude<DocumentationVersionScope, "package"> | null;
  exactPackageUrl: string;
  llmsUrl: string | null;
  llmsScope: "exact" | "major" | "current" | null;
}

interface DocumentationRoute {
  officialDocs?: (pkg: PackageInfo) => { url: string; scope: "exact" | "major" | "current" } | null;
  llms?: (pkg: PackageInfo) => { url: string; scope: "exact" | "major" | "current" } | null;
}

const currentDocs: Record<string, string> = {
  "@biomejs/biome": "https://biomejs.dev/guides/getting-started/",
  "@lingui/core": "https://lingui.dev/introduction",
  "@tanstack/react-query": "https://tanstack.com/query/latest/docs/framework/react/overview",
  "babel-plugin-react-compiler": "https://react.dev/learn/react-compiler",
  dompurify: "https://github.com/cure53/DOMPurify#readme",
  eslint: "https://eslint.org/docs/latest/",
  "html-react-parser": "https://github.com/remarkablemark/html-react-parser#readme",
  i18next: "https://www.i18next.com/overview/getting-started",
  "isomorphic-dompurify": "https://github.com/kkomelin/isomorphic-dompurify#readme",
  msw: "https://mswjs.io/docs/",
  nuqs: "https://nuqs.dev/docs",
  "openapi-typescript": "https://openapi-ts.dev/introduction",
  orval: "https://orval.dev/overview",
  playwright: "https://playwright.dev/docs/intro",
  prettier: "https://prettier.io/docs/",
  "react-html-parser": "https://github.com/wrakky/react-html-parser#readme",
  "react-hook-form": "https://react-hook-form.com/get-started",
  "react-i18next": "https://react.i18next.com/",
  "react-query-kit": "https://github.com/HuolalaTech/react-query-kit#readme",
  "sanitize-html": "https://github.com/apostrophecms/sanitize-html#readme",
  storybook: "https://storybook.js.org/docs",
  swr: "https://swr.vercel.app/docs/getting-started",
  typescript: "https://www.typescriptlang.org/docs/handbook/intro.html",
  valibot: "https://valibot.dev/guides/introduction/",
  vitest: "https://vitest.dev/guide/",
  xss: "https://github.com/leizongmin/js-xss#readme",
  zod: "https://zod.dev/",
  zustand: "https://zustand.docs.pmnd.rs/getting-started/introduction",
};

const documentationRoutes: Record<string, DocumentationRoute> = {
  next: {
    officialDocs: nextDocs,
    llms: nextLlms,
  },
  react: {
    officialDocs: (pkg) => {
      if (pkg.major === 18 || pkg.major === 19) {
        return { url: `https://${pkg.major}.react.dev/`, scope: "major" };
      }

      return { url: "https://react.dev/versions", scope: "current" };
    },
  },
  vite: {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://v${major}.vite.dev/guide/`),
  },
  "react-router": {
    officialDocs: reactRouterDocs,
  },
  "react-router-dom": {
    officialDocs: reactRouterDocs,
  },
  tailwindcss: {
    officialDocs: (pkg) => {
      if (pkg.major === 3) {
        return { url: "https://v3.tailwindcss.com/docs/installation", scope: "major" };
      }

      if (pkg.major === 4) {
        return { url: "https://tailwindcss.com/docs/installation", scope: "major" };
      }

      return null;
    },
  },
  zod: {
    officialDocs: (pkg) => {
      if (pkg.major === 3) {
        return { url: "https://v3.zod.dev/", scope: "major" };
      }

      if (pkg.major === 4) {
        return { url: "https://zod.dev/", scope: "major" };
      }

      return currentRoute(pkg);
    },
    llms: (pkg) => (pkg.major === 4 ? { url: "https://zod.dev/llms.txt", scope: "major" } : null),
  },
  "@tanstack/react-query": {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://tanstack.com/query/v${major}/docs/framework/react/overview`),
  },
  storybook: {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://storybook.js.org/docs/${major}`),
  },
  "@storybook/react": {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://storybook.js.org/docs/${major}`),
  },
  "@mantine/core": {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://v${major}.mantine.dev/`),
  },
  vitest: {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://v${major}.vitest.dev/guide/`),
  },
  jest: {
    officialDocs: (pkg) => majorDocs(pkg, (major) => `https://jestjs.io/docs/${major}.0/getting-started`),
  },
};

export function resolveLibraryDocumentation(stack: DetectedStack): LibraryDocumentationEntry[] {
  return Object.values(stack.packages)
    .filter((pkg): pkg is PackageInfo & { version: string } => pkg.version !== null)
    .map((pkg) => resolveEntry(pkg))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export function renderLibraryDocumentationLlmsTxt(stack: DetectedStack): string {
  const entries = resolveLibraryDocumentation(stack);
  const preferred = entries.map((entry) => {
    const source = entry.versionSource === "installed" ? "installed" : `inferred from declared range ${entry.declaredRange}`;
    const scope = describeScope(entry.preferredScope);
    return `- [${entry.packageName} ${entry.version}](${entry.preferredUrl}): ${scope}; version ${source}.`;
  });
  const currentOnly = entries
    .filter((entry) => entry.officialDocsScope === "current" && entry.officialDocsUrl)
    .map(
      (entry) =>
        `- [${entry.packageName} current docs](${entry.officialDocsUrl}): Unpinned upstream documentation; verify APIs against ${entry.packageName} ${entry.version}.`,
    );
  const upstreamLlms = entries
    .filter((entry) => entry.llmsUrl && entry.llmsScope === "current")
    .map(
      (entry) =>
        `- [${entry.packageName} upstream llms.txt](${entry.llmsUrl}): Upstream current-version index; the version-matched link above takes precedence.`,
    );
  const exactPackages = entries.map((entry) => {
    const qualification =
      entry.versionSource === "installed"
        ? "Exact installed package README and metadata fallback."
        : `Baseline package reference inferred from ${entry.declaredRange}; install dependencies and rerun node-boost update to pin the resolved version.`;
    return `- [${entry.packageName}@${entry.version}](${entry.exactPackageUrl}): ${qualification}`;
  });

  return [
    "# Project library documentation",
    "",
    "> Official, version-aware documentation routes for the libraries detected in this project.",
    "",
    "Use Version-matched documentation first. A major-version archive is preferred over current docs. When no stable upstream archive is known, use the exact package reference and treat current docs as secondary.",
    "",
    "Run `node-boost update` after dependency changes. Entries inferred from declared ranges become exact after dependencies are installed.",
    "",
    "## Version-matched documentation",
    "",
    ...(preferred.length > 0 ? preferred : ["- No detected libraries with resolvable versions."]),
    ...(currentOnly.length > 0 ? ["", "## Current documentation (secondary)", "", ...currentOnly] : []),
    ...(upstreamLlms.length > 0 ? ["", "## Upstream AI-readable indexes (secondary)", "", ...upstreamLlms] : []),
    "",
    "## Exact package references",
    "",
    ...exactPackages,
    "",
  ].join("\n");
}

function resolveEntry(pkg: PackageInfo & { version: string }): LibraryDocumentationEntry {
  const route = documentationRoutes[pkg.name];
  const official = route?.officialDocs?.(pkg) ?? currentRoute(pkg);
  const llms = route?.llms?.(pkg) ?? null;
  const exactPackageUrl = `https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
  const hasVersionedOfficialDocs = official?.scope === "exact" || official?.scope === "major";
  const hasVersionedLlms = llms?.scope === "exact" || llms?.scope === "major";

  return {
    packageName: pkg.name,
    version: pkg.version,
    declaredRange: pkg.declaredRange,
    versionSource: pkg.source === "node_modules" ? "installed" : "declared-range",
    preferredUrl: hasVersionedLlms ? llms.url : hasVersionedOfficialDocs ? official.url : exactPackageUrl,
    preferredScope: hasVersionedLlms ? llms.scope : hasVersionedOfficialDocs ? official.scope : "package",
    officialDocsUrl: official?.url ?? null,
    officialDocsScope: official?.scope ?? null,
    exactPackageUrl,
    llmsUrl: llms?.url ?? null,
    llmsScope: llms?.scope ?? null,
  };
}

function nextDocs(pkg: PackageInfo): { url: string; scope: "major" | "current" } | null {
  if (pkg.major === 14 || pkg.major === 15) {
    return { url: `https://nextjs.org/docs/${pkg.major}`, scope: "major" };
  }

  if (pkg.major === 16) {
    return { url: "https://nextjs.org/docs", scope: "current" };
  }

  return null;
}

function nextLlms(pkg: PackageInfo): { url: string; scope: "major" | "current" } | null {
  if (pkg.major === 14 || pkg.major === 15) {
    return { url: `https://nextjs.org/docs/${pkg.major}/llms.txt`, scope: "major" };
  }

  if (pkg.major === 16) {
    return { url: "https://nextjs.org/docs/llms.txt", scope: "current" };
  }

  return null;
}

function currentRoute(pkg: PackageInfo): { url: string; scope: "current" } | null {
  const url = currentDocs[pkg.name];
  return url ? { url, scope: "current" } : null;
}

function majorDocs(
  pkg: PackageInfo,
  createUrl: (major: number) => string,
): { url: string; scope: "major" } | null {
  return pkg.major === null ? null : { url: createUrl(pkg.major), scope: "major" };
}

function reactRouterDocs(pkg: PackageInfo): { url: string; scope: "exact" } | null {
  if (!pkg.version || pkg.major === null) {
    return null;
  }

  const path = pkg.major <= 6 ? "start/overview" : "start/library/routing";
  return { url: `https://reactrouter.com/${pkg.version}/${path}`, scope: "exact" };
}

function describeScope(scope: DocumentationVersionScope): string {
  if (scope === "exact") {
    return "official documentation pinned to the detected exact version";
  }

  if (scope === "major") {
    return "official documentation pinned to the detected major version";
  }

  if (scope === "current") {
    return "current official documentation (not version-pinned)";
  }

  return "exact published package reference because no stable versioned documentation archive is known";
}
