# MSW

- MSW is available as the network boundary for tests, Storybook, or development mocks. Reuse the existing worker/server setup and handler factories.
- Model success, relevant error envelopes, empty responses, latency, and authorization failures at the HTTP boundary; do not mock the internal query hook in integration tests.
- Reset runtime handlers between tests and fail on unexpected requests when the project configuration supports it.
- Keep response fixtures contract-compatible and avoid copying production secrets or personal data.
