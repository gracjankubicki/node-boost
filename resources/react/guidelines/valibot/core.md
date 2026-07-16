# Valibot

- Valibot is an installed runtime-schema library. Extend existing schemas and imports; do not add Zod solely because another guideline example uses it.
- Parse or safe-parse API, form, environment, and URL boundaries. TypeScript types or generated clients alone do not validate runtime data.
- Use the repository's React Hook Form resolver/error mapping and explicit coercion/transform conventions.
- Compose schemas rather than duplicating contracts, and derive output/input types with Valibot's helpers used by the installed major.
- Validate again at the server boundary even when client-side form validation already ran.
