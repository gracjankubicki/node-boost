---
name: secure-by-default
description: Handle untrusted content, env variables, Server Actions and server-only code safely in React/Next apps.
---

# Secure by Default

## When to use this skill

Use when rendering user/CMS-provided content, adding env variables, writing Server Actions, or fixing `NB-ARCH-011`/`NB-ARCH-012`.

## Procedure

1. Rich text/HTML to render → establish provenance first (static literal, write-time-sanitized, trusted internal, or arbitrary CMS/user content). Prefer JSX for plain data. For dynamic HTML, use an approved sanitizer compatible with the runtime (`DOMPurify` in a browser, `isomorphic-dompurify`/`sanitize-html` on the server) and an allowlist for elements, attributes, and URL schemes.
2. New env variable → secret? no public prefix, access via `env.ts` server-side only. Client-needed? confirm it is harmless when public, then prefix (`NEXT_PUBLIC_`/`VITE_`).
3. New Server Action → first lines: auth check, then `schema.parse(input)`; return minimal data; add cache invalidation after writes.
4. Data-layer module touching secrets → `import "server-only"` at the top.

## Fixing findings

- `NB-ARCH-011`: parser libraries and `dangerouslySetInnerHTML` are both sinks. Sanitize with an approved imported library, replace raw HTML with JSX, or document a verified write-time guarantee with a reasoned suppression. A helper merely named `sanitize` is not trusted by the audit.
- `NB-ARCH-012`: remove the public prefix and move usage server-side; if genuinely public, rename so it does not masquerade as a secret and suppress with a reason.
