---
name: project-conventions-and-validation
description: Discover repository instructions, package manager, scripts, generators, and validation gates before changing or checking code.
---

# Project Conventions and Validation

## When to use this skill

Use before modifying or validating any repository, and whenever a generated file, unfamiliar command, or local convention is involved.

## Procedure

1. Read every applicable `AGENTS.md` plus the project README and relevant package-level instructions. Inspect `package.json`, lockfiles, workspace config, Makefiles/task runners, and nearby code.
2. Identify the package manager and repository-approved focused/full commands. Prefer project wrappers (for example Make targets) and scoped arguments; never invent `npm test`, formatting, or Node Boost commands.
3. Identify generated boundaries and required workflows: OpenAPI clients, schema generation, route/codegen, localization extraction/compilation, Storybook/visual checks, sitemaps, and source maps. Do not hand-edit generated output.
4. Preserve the established architecture, file placement, naming, formatter, and library choices unless the request explicitly authorizes a migration.
5. Match verification to risk. Run focused checks first, then the documented full gate when feasible. Report commands that could not run and why; do not claim success from source inspection alone.
6. Use `application_info` and `node-boost audit --changed` only when Node Boost is installed/configured in the target project.
