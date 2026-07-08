# Error and Loading Boundaries

Every App Router segment that fetches data needs designed boundaries: `loading.tsx` streams an instant skeleton, `error.tsx` scopes failures to the segment.

<code-snippet name="Segment with boundaries" lang="text">
app/
├── error.tsx            # root boundary — the global handler
└── invoices/
    ├── page.tsx         # async, awaits data
    ├── loading.tsx      # streamed IMMEDIATELY while page awaits
    └── error.tsx        # failure renders here, rest of the app lives
</code-snippet>

## Rules

- `NB-ARCH-010` (warn): a segment whose `page.tsx` fetches data with no `loading.*` **and** no `error.*` anywhere up its branch. A root-level `error.tsx` satisfies the whole tree — this is not a mandate for twenty files.
- `error.tsx` **must be a Client Component**; it receives `error` and `reset()` for retry. Add `global-error.tsx` for failures in the root layout, `not-found.tsx` for 404 semantics.
- `loading.tsx` is an automatic Suspense boundary around the page. For slow islands inside a fast page, wrap the island alone:

<code-snippet name="Granular Suspense" lang="tsx">
<Suspense fallback={<ChartSkeleton />}>
  <RevenueChart /> {/* slow await only here; rest streams instantly */}
</Suspense>
</code-snippet>

## Why this is structural in Next 16

Partial Prerendering splits the page into a static shell plus dynamic holes — and the holes are defined by Suspense boundaries. No boundaries, no PPR.

## Judgment calls

- Skeletons mirror the shape of the coming content (anti-layout-shift); a page rendered fully from cache may not need one.
- Skeleton fatigue is real: one skeleton per meaningful region, not five spinners racing.
- Boundary reset drops the subtree's state — fine, but know it.

Design of the fallback *content* (empty/error UX) lives in the ui-states guideline.
