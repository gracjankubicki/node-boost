# Tailwind CSS Core

- Utility-first in JSX; reuse through React components, not through custom CSS classes. Keep `@apply` to a rare minimum.
- Never construct class names dynamically (`text-${color}-500`) — the compiler scans sources statically; interpolated classes silently don't exist. Map conditions to full literal class strings.
- Use theme tokens for colors/spacing; arbitrary values (`w-[347px]`) are one-off exceptions with a reason.
- Use the repository's existing variant/merge mechanism (often CVA + `tailwind-merge`); simple conditional classes may stay simple.
- Keep class order consistent with the project's formatter (prettier-plugin-tailwindcss or Biome's sorting).
- Follow the version-specific Tailwind guideline — configuration differs fundamentally between v3 and v4.
