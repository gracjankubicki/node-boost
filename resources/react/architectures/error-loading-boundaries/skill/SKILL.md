---
name: error-loading-boundaries
description: Add loading.tsx / error.tsx / Suspense boundaries to App Router segments that fetch data.
---

# Error and Loading Boundaries

## When to use this skill

Use when creating a data-fetching page/segment in the App Router, or fixing `NB-ARCH-010`.

## Procedure

1. New segment fetching data → add `loading.tsx` (skeleton mirroring the content shape) and decide the `error.tsx` level: segment-local when the segment can fail independently, otherwise rely on a parent boundary.
2. `error.tsx`: mark `"use client"`, render a short explanation + retry button calling `reset()`; report the error to monitoring if the project has it.
3. Slow widget inside a fast page → wrap only that widget in `<Suspense fallback={<Skeleton />}>` instead of blocking the page.
4. 404 semantics → `not-found.tsx` + `notFound()` from the data layer.
5. Do not add skeletons to fully cached/static pages — verify the page is actually dynamic first.
