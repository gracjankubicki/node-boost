---
name: next-development
description: Build Next.js App Router features using the detected major, configured capabilities, and established project conventions.
---

# Next Development

## When to use this skill

Use when adding or changing pages, layouts, route handlers, Server Actions, or data flow in this Next.js app.

## Procedure

1. Read local instructions and nearby routes, then check the Next major (`application_info` when Node Boost is installed). Next 14, 15, and 16 cache semantics differ; in Next 16 also inspect `next.config.*` for `cacheComponents`.
2. New route: follow the existing `app/` and data-layer layout. Keep the page server-first when practical; add inherited or local loading/error boundaries only when the route genuinely suspends on remote data.
3. Interactivity usually goes into a `"use client"` leaf using the repository's component/feature layout (server-first-components skill). Document deliberate browser-only route exceptions.
4. Mutations: preserve the established Server Action, Route Handler, SWR/Query, form, and runtime-schema stack. Every server mutation still requires auth, authorization, validation, and precise cache updates/invalidation.
5. Use framework primitives: `next/image`, `next/font`, `next/link`, Metadata API.
6. Before handing back, run repository-approved validation. If Node Boost is installed, also run `node-boost audit --changed`.
