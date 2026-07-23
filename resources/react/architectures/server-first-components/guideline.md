# Server-First Components

In the App Router, components are Server Components by default. Keep them that way: fetch data on the server, ship less JavaScript, and push `"use client"` down to interactive leaves.

## Rules

- Never put `"use client"` in `page.tsx` or `layout.tsx` (`NB-ARCH-003`, error). Route entries stay server-side; extract the interactive part into a leaf component instead.
- Do not add `"use client"` to files with no hooks, event handlers, or browser APIs (`NB-ARCH-004`, warn) — the directive is not a talisman, it makes the whole subtree client-side.
- A genuinely full-client page (canvas playground, embedded editor shell) is a documented exception: `// nb-disable NB-ARCH-003 -- <reason>`.

<code-snippet name="Interactive leaf, server entry" lang="tsx">
// app/invoices/page.tsx — Server Component: async, fetches data
export default async function InvoicesPage() {
  const invoices = await getInvoices()
  return <InvoiceTable invoices={invoices} toolbar={<InvoiceFilter />} />
}

// features/invoices/components/InvoiceFilter.tsx — client leaf
"use client"
export function InvoiceFilter() {
  const [query, setQuery] = useState("")
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />
}
</code-snippet>

## Mental model

`"use client"` marks a boundary, not a component: everything imported below it becomes client code. Server Components can render Client Components and pass serializable props (no functions, no class instances) — compose interactivity in, don't lift the whole page out.

## Next 16 capability check

- `"use cache"`, `cacheLife`, and the Cache Components shell/dynamic-hole model require `cacheComponents: true` in `next.config.*`.
- Without that flag, keep the project's fetch/revalidation and dynamic-rendering model; server-first boundaries still reduce client JavaScript.
- Do not generate legacy idioms: `getServerSideProps`/`getStaticProps` belong to the Pages Router, not here.
