---
name: testing-strategy
description: Test behavior using the repository's installed runner, DOM tools, network mocking, stories, and E2E capabilities.
---

# Testing Strategy

## When to use this skill

Use when adding tests, fixing a bug, or reviewing test quality.

## Procedure

1. Inspect local instructions, scripts, and nearby tests to identify Jest/Vitest, Testing Library, `userEvent`, MSW, Storybook interactions, and E2E tooling independently. Do not generate imports or commands for tools that are not installed.
2. Prefer the smallest behavioral test that proves the risk: render and interact through accessible roles/labels when DOM tooling exists.
3. Use the repository's network seam. MSW is preferred when already installed; focused unit tests may mock a collaborator at a deliberate seam.
4. Cover loading/error/empty only for views where those states exist and matter.
5. Pure logic → unit test; complex hooks → `renderHook` when available; async Server Components → data-layer/integration/E2E coverage according to the current stack.
6. Update a critical E2E journey only when an E2E runner is installed. Adding new test infrastructure is a separate explicit architectural change.
7. Run the repository's documented focused and full commands, including wrappers, generation, or i18n prerequisites.

When the repository uses `node:test`, preserve that runner and its scripts. Native erasable TypeScript needs Node 22.18 or 23.6+, or Node 22.6+ with `--experimental-strip-types`. Type stripping is not typechecking. Read the Node TypeScript support documentation and project runtime constraints before changing commands.
