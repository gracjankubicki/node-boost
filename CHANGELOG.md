# Changelog

## 0.3.0 - 2026-07-16

- Made `guard` and agent hooks fail closed when source files cannot be fully audited.
- Added a pre-AST source-size limit so pathological files cannot create an unbounded parse step.
- Made `install`, `update`, and `doctor` return failure for conflicts, drift, and stale generated state.
- Added strict rule-ID and per-rule option validation to runtime config and the generated JSON Schema.
- Replaced executable plugin entrypoints with versioned static `node-boost.plugin.json` manifests.
- Added Node 20/22/24 CI, a Windows lifecycle smoke, and trusted npm publishing with provenance.
- Updated the build dependency tree to remove the reported esbuild advisory.

## 0.2.0 - 2026-07-15

- Added the content-only `@node-boost/node-boost/plugin` contract with strict runtime validation.
- Added explicit plugin loading, namespaced architectures, variants, owned-resource cleanup, doctor/MCP reporting, and packed plugin smoke coverage.
- Removed the experimental `0.1.x` package-root JavaScript exports; use CLI/MCP or `@node-boost/node-boost/plugin`.
- Added AST-based Vite component detection and conventional API data-layer paths to reduce audit false positives.
- Ignored explicit stylesheet imports in TypeScript module-resolution warnings.
- Replaced growing-project semantic diagnostics with parse-only diagnostics in the audit reader.
- Reworked audit, suppression, and security detection around AST/scanner/structural analysis and added a zero-regex audit gate.
- Fixed committed-base guard scope, delete/rename handling, and package-manager command forwarding.
- Added generated-resource ownership, safe stale cleanup, integration unmerge, config lifecycle checks, and local schema generation.
- Updated agent hook payload handling and loop prevention for Codex, Claude Code, and Cursor.
- Added clean-checkout tarball, public-surface, and packed-consumer release gates.

## 0.1.0 - 2026-07-08

- Initial React-focused release of node-boost.
- Added stack detection for Next.js and Vite React projects.
- Added generated `.ai/guidelines/**` and `.ai/skills/**` resources for React, Next, Vite, React Router, Tailwind CSS, TypeScript, zod, React Query, Zustand, Vitest, and Playwright.
- Added 13 architecture guidance patterns and feature-modules boundary variants.
- Added CLI commands: `install`, `update`, `doctor`, `audit`, `guard`, `explain`, and `mcp`.
- Added MCP tools: `application_info`, `list_routes`, `doctor`, `audit`, and `explain_finding`.
- Added 14 audit rules (`NB-ARCH-001` through `NB-ARCH-014`) with suppression and machine-readable reports.
- Added Claude Code, Codex, and Cursor agent integration, including optional guard hooks.
- Added GitHub Actions CI for package checks.
