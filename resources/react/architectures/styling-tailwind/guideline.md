# Styling with Tailwind

Utility-first with discipline: tokens from the theme, variants through cva, reuse through components.

## Check the Tailwind major first

Tailwind 4 is CSS-first by default:

<code-snippet name="Tailwind 4 CSS-first config" lang="css">
@import "tailwindcss";
@theme {
  --color-brand: oklch(0.62 0.19 260);
  --spacing-gutter: 1.5rem;
}
</code-snippet>

Do not generate a v3-style JS config by default. Tailwind 4 can still load legacy JavaScript configuration through `@config`; preserve it when the repository deliberately uses compatibility mode.

## Rules

- **Tokens over arbitrary values**: colors/spacing come from `@theme`; `w-[347px]` needs a reason, or the codebase grows fifty shades of gray.
- **Variants via cva + tailwind-merge**, not string concatenation:

<code-snippet name="Variants with cva" lang="ts">
const button = cva("rounded px-4 py-2 font-medium", {
  variants: { intent: { primary: "bg-brand text-white", danger: "bg-red-600 text-white" } },
  defaultVariants: { intent: "primary" },
})
</code-snippet>

- **Never build class names dynamically**: `text-${color}-500` does not exist in the build — the compiler scans sources statically; a class not written literally is a class not generated. Map to full literal classes instead.
- Extract a component when repeated markup has the same semantics/behavior. Textually repeated utility strings may instead deserve a token/helper—or no abstraction when repetition is coincidental.
- Conditional classes through a `cn()` helper (clsx + tailwind-merge); class order handled by prettier-plugin-tailwindcss (or Biome's sorting when the project uses Biome).
