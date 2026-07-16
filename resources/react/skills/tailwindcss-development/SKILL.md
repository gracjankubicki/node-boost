---
name: tailwindcss-development
description: Style with Tailwind matching this project's major version — tokens, cva variants, no dynamic class names.
---

# Tailwind CSS Development

## When to use this skill

Use when styling components or touching Tailwind configuration.

## Procedure

1. Check the Tailwind major and current configuration. v4 is CSS-first (`@theme`) but can deliberately load legacy JS configuration through `@config`; v3 uses JS config + `content` globs.
2. Use theme tokens; introduce new tokens in the theme, not arbitrary values.
3. Variants with `cva` + `tailwind-merge`; conditionals through `cn()` — never interpolate class fragments (`text-${x}-500` doesn't exist in the build).
4. Repeated class strings → extract a `components/ui/` component instead of `@apply`.
