---
name: tailwindcss-development
description: Style with Tailwind matching this project's major version — tokens, cva variants, no dynamic class names.
---

# Tailwind CSS Development

## When to use this skill

Use when styling components or touching Tailwind configuration.

## Procedure

1. Check the Tailwind major first: v4 = CSS-first config (`@theme`, no `tailwind.config.js`); v3 = JS config + `content` globs. Follow the versioned guideline.
2. Use theme tokens; introduce new tokens in the theme, not arbitrary values.
3. Variants with `cva` + `tailwind-merge`; conditionals through `cn()` — never interpolate class fragments (`text-${x}-500` doesn't exist in the build).
4. Repeated class strings → extract a `components/ui/` component instead of `@apply`.
