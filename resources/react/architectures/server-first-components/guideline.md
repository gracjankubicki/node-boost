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

## Next 16 specifics

- Nothing is cached by default; caching is explicit via `"use cache"` on components/functions — which only works if the tree stays server-first.
- Partial Prerendering splits pages into a static shell plus dynamic holes in `<Suspense>`. A client-rooted page opts out of all of it.
- Do not generate legacy idioms: `getServerSideProps`/`getStaticProps` belong to the Pages Router, not here.
