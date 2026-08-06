# Jest

- Match the repository's configured environment, transforms, setup files, and Testing Library version; do not paste Vitest APIs (`vi.*`) into Jest tests.
- Use `jest.fn()`/`jest.spyOn()` at deliberate collaborator seams and restore mocks between tests.
- Prefer behavior through roles/labels when Testing Library is installed. Use `userEvent` only when declared/configured.
- Mock network requests with the project's existing mechanism (MSW when installed, otherwise the established fetch/client seam); never allow unit tests to reach the real network.
- Run focused and full tests through documented package-manager commands or wrappers, including required generation or build prerequisites.
