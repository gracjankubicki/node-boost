---
name: content-modeling
description: Design typed Astro content collections and stable content-to-route contracts.
---

# Content Modeling

## When to use this skill

Use when introducing or changing a content collection, loader, schema, or collection-driven route.

## Procedure

1. Identify the source, freshness, publication state, and consumers of the content.
2. Define the smallest explicit schema and model relationships as IDs or validated references.
3. Separate loading, normalization, filtering, and presentation.
4. Confirm whether the consuming route is build-time or request-time and review cache behavior.
5. Test malformed input, unpublished content, missing relations, and the empty state.
