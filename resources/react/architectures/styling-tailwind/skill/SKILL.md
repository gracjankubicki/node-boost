---
name: styling-tailwind
description: Style components with Tailwind using theme tokens, cva variants and component extraction — matching the project's Tailwind major version.
---

# Styling with Tailwind

## When to use this skill

Use when styling components, adding visual variants, or touching Tailwind configuration.

## Procedure

1. Check the project's Tailwind major (see application_info / package.json). v4: config lives in CSS (`@theme`); never create `tailwind.config.js`. v3: JS config applies.
2. New color/spacing → add a token to the theme; avoid arbitrary values unless one-off and justified.
3. Component with visual variants → define with cva, merge overrides with tailwind-merge, expose a `variant` prop.
4. Conditional classes → `cn(base, cond && "...")`; never template-interpolate class fragments.
5. Same class string appearing twice → extract a component in `components/ui/`.
