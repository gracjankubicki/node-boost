---
name: styling-tailwind
description: Style components with Tailwind using theme tokens, cva variants and component extraction — matching the project's Tailwind major version.
---

# Styling with Tailwind

## When to use this skill

Use when styling components, adding visual variants, or touching Tailwind configuration.

## Procedure

1. Check the project's Tailwind major and existing configuration. v4 is CSS-first (`@theme`) but may deliberately load a legacy JS config through `@config`; v3 uses JS configuration.
2. New color/spacing → add a token to the theme; avoid arbitrary values unless one-off and justified.
3. Component with meaningful visual variants → use the project's existing mechanism (often CVA + tailwind-merge); simple conditional classes may remain clearer.
4. Conditional classes → `cn(base, cond && "...")`; never template-interpolate class fragments.
5. Extract a component only when repeated markup shares semantics/behavior, and place it in the repository's established shared boundary. Textual class repetition alone is not sufficient.
