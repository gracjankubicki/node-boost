# Next.js Core

- App Router conventions: routes are folders; `page.tsx` renders, `layout.tsx` wraps, `route.ts` handles HTTP, `loading.tsx`/`error.tsx` are boundaries. Do not mix in Pages Router idioms (`getServerSideProps`, `getStaticProps`, `_app.tsx`) unless the project actually uses `pages/`.
- Components are Server Components by default; `"use client"` only on interactive leaves (see server-first-components guideline).
- Data flows through the project's established data layer. Mutations may use Server Actions, Route Handlers, or the installed client cache/form stack; every server endpoint still needs auth, authorization, and runtime validation.
- Use the framework's primitives before reaching for libraries: `next/image` for images, `next/font` for fonts, `next/link` for navigation, Metadata API for `<head>`.
- Route params and `searchParams` are untrusted input — validate before use.
- Prefer `redirect()`/`notFound()` from the server over client-side workarounds.
