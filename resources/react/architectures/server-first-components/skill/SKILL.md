---
name: server-first-components
description: Decide where the "use client" boundary goes in Next.js App Router code and keep pages/layouts server-side.
---

# Server-First Components

## When to use this skill

Use when creating pages/layouts, when tempted to add `"use client"`, or when fixing `NB-ARCH-003`/`NB-ARCH-004` findings.

## Procedure

1. Start every component as a Server Component (no directive). Fetch data with `await` in the component body via the data layer.
2. Add `"use client"` only when the file actually uses state/effects, event handlers, or browser APIs.
3. If a page needs interactivity, extract the interactive part into a leaf and render it from the server page. A deliberately browser-only route may keep a documented client page exception.
4. Pass only serializable props across the boundary. Need a callback? Move the state down into the client leaf, or use a Server Action.
5. Choose caching from the Next major and `next.config.*`. Add `"use cache"` only when Cache Components is enabled; otherwise preserve the version-appropriate fetch/revalidation model. Wrap genuinely suspending islands in `<Suspense>`.

## Fixing findings

- `NB-ARCH-003`: move interactivity to a leaf; keep the entry async and server-side.
- `NB-ARCH-004`: delete the unnecessary directive — the file has nothing client-only in it.
