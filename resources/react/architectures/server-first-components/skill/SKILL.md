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
3. If a page needs interactivity, extract the interactive part into a leaf component in the feature and render it from the server page — never mark the page itself.
4. Pass only serializable props across the boundary. Need a callback? Move the state down into the client leaf, or use a Server Action.
5. For caching, add `"use cache"` in the data layer function, not in the component; wrap truly dynamic islands in `<Suspense>`.

## Fixing findings

- `NB-ARCH-003`: move interactivity to a leaf; keep the entry async and server-side.
- `NB-ARCH-004`: delete the unnecessary directive — the file has nothing client-only in it.
