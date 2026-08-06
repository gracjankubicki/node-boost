---
name: testing-frontend
description: Test frontend behavior with the repository's installed runner, DOM, network-mocking, Storybook, and E2E tools.
---

# Frontend Testing

## When to use this skill

Use when writing or fixing tests for components, hooks, or user flows.

## Procedure

1. Read local instructions/scripts and nearby tests; detect Jest/Vitest, Testing Library, `userEvent`, MSW, Storybook, and E2E separately.
2. Prefer a behavioral component test through roles/labels when the DOM toolchain is installed.
3. Use MSW when installed; otherwise follow the existing network seam. A focused internal mock is acceptable for a deliberate unit boundary.
4. Cover only the remote-data states the view can enter. Pure logic → unit test; complex hooks → `renderHook` when available.
5. Update critical journeys only when the repository has an E2E runner. Adding missing infrastructure is a separate decision.
6. Bug fix? Reproduce it with the smallest relevant test, then fix and run repository-approved commands.
