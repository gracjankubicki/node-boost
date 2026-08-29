# React as an Astro Island

Use `@astrojs/react` when a React component is a deliberate interactive or server-rendered island inside an Astro page.

- Import the component from the Astro route and choose `client:load`, `client:idle`, `client:visible`, `client:media`, or `client:only` from the interaction contract.
- Treat the Astro boundary as the source of truth for data loading and authorization. Pass a narrow, serializable props object; do not pass secrets, request objects, functions, or database clients.
- Keep browser APIs and hooks inside the hydrated React component. Do not assume Next.js Server Components, Server Actions, or Next-specific runtime behavior is available.
- Preserve React's accessible semantics and the repository's component/state conventions inside the island; do not move global application state into Astro props without a clear contract.
- Test the server-rendered markup separately from hydration and browser interaction.
