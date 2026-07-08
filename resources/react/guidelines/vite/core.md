# Vite Core

- This is a client-rendered SPA: every component is client code, all secrets stay on the backend — the browser bundle is public.
- Env variables: only `VITE_`-prefixed values reach the client (`import.meta.env.VITE_X`) — and they are readable by every visitor. Never prefix secrets; validate env in one `env.ts` (see typed-contracts and secure-by-default guidelines).
- Use `import.meta.env` (`DEV`, `PROD`, `MODE`) — not `process.env` in app code.
- Code-split at route level with dynamic `import()`; heavy rarely-used components load lazily with a skeleton fallback.
- Static assets through imports (hashed URLs) or `public/` for verbatim files; prefer imports.
- Config in `vite.config.ts` stays lean — resolve aliases (`@/` → `src/`) should match `tsconfig.json` paths.
