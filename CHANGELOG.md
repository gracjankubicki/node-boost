# Changelog

## Unreleased

- Added a generated `.ai/docs/llms.txt` library index, deterministic version-aware documentation routing, agent instructions, and the `library_docs` MCP tool.
- Made resource composition capability-aware: added explicit React Compiler/Cache Components detection plus Next 14, React Router 6, SWR, Valibot, React Hook Form, Storybook, Mantine, localization, MSW, rich-text, and generated-client guidance.
- Stopped treating React 19 as proof of React Compiler and Next 16 as proof of Cache Components; corrected the React 19 optimistic-update example.
- Replaced raw-HTML regex checks with AST-based JSX/parser sink detection and removed the project-wide runtime-validation exemption for generated API clients.
- Made non-interactive architecture selection conservative, inferring feature-module boundaries only from an existing feature tree and avoiding duplicate Tailwind/testing skills.
- Improved JSONC tsconfig parsing, generated-file exclusions, remote-data boundary detection, and server-state audit heuristics.

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
