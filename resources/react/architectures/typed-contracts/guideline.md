# Typed Contracts

TypeScript types do not exist at runtime. Validate external data at system boundaries with the schema library already used by the repository (for example Zod or Valibot), derive types where that library supports it, and trust values only after parsing.

## Validate at the boundary

1. **API responses**—parse untrusted success payloads and relevant error envelopes in the data layer. Generated TypeScript clients do not make runtime JSON trustworthy. Generated runtime schemas are useful only when the application actually invokes them.
2. **User input**—validate through the established form integration and again at every server endpoint; handle coercion explicitly.
3. **Environment variables**—centralize them in a validated env module (`NB-ARCH-008`).
4. **URL params/search state**—parse them as untrusted strings, including through an installed URL-state library such as `nuqs`.

<code-snippet name="Schema as single source of truth" lang="ts">
export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["draft", "paid", "void"]),
})
export type Invoice = z.infer<typeof invoiceSchema>
</code-snippet>

The snippet uses Zod; use the equivalent Valibot or project-specific schema when that is the established dependency.

## Rules

- Do not cast external data to its hoped-for type. Parse it (`NB-ARCH-007` flags raw JSON boundaries in configured data-layer paths).
- Generated files are excluded, but manual endpoints and wrappers remain audited even when Orval/openapi-typescript is installed.
- If runtime validation is centralized in a project helper, list its imported function name under `NB-ARCH-007`'s `runtimeValidatorFunctions` rule option; arbitrary function names are not trusted automatically.
- Define whether validation is fail-closed or fail-open with telemetry. A validator that only logs and returns original data is observability, not enforcement.
- Avoid duplicate schemas for the same contract; compose or derive narrower views with the installed library.
