# Storybook

- Follow the repository's required story placement, title hierarchy, decorators, and providers whenever reusable UI changes.
- Cover representative visual variants and meaningful loading/error/empty states without turning every prop combination into a story.
- Keep stories deterministic and network-independent through the project's loaders/MSW integration when installed.
- Add interaction tests only when Storybook test tooling is configured. Do not substitute stories for focused logic tests or critical E2E coverage.
- Run the documented Storybook/Chromatic/visual-regression command when the repository requires it.
