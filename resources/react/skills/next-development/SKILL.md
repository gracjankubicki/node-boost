---
name: next-development
description: Build Next.js App Router features end-to-end — server-first pages, data layer, Server Actions, boundaries — per this project's version and conventions.
---

# Next Development

## When to use this skill

Use when adding or changing pages, layouts, route handlers, Server Actions, or data flow in this Next.js app.

## Procedure

1. Check the Next major (`application_info`) and follow the versioned guideline — caching semantics differ between 15 and 16.
2. New route: folder in `app/`, async server `page.tsx`, data via the feature's `api/` functions; add `loading.tsx`/`error.tsx` when the page fetches (error-loading-boundaries skill).
3. Interactivity goes into `"use client"` leaf components inside the feature (server-first-components skill).
4. Mutations: Server Action with auth check + zod validation, then cache invalidation (`revalidateTag`/`updateTag` per version).
5. Use framework primitives: `next/image`, `next/font`, `next/link`, Metadata API.
6. Before handing back: `node-boost audit --changed` and fix findings.
