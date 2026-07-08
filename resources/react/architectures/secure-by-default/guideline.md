# Secure by Default

JSX escapes everything automatically. The vulnerabilities live in the escape hatches — close them by default.

## XSS: one door, keep it locked

<code-snippet name="Sanitize or don't render" lang="tsx">
// NB-ARCH-011 (error): raw HTML from any dynamic source
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// The only acceptable form — sanitize first:
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.body) }} />
</code-snippet>

Prefer rendering data as JSX; reach for raw HTML only for trusted rich text (CMS/editor output), always sanitized (DOMPurify client-side, isomorphic-dompurify/sanitize-html on the server — or sanitize at write time). Trusted static literals may use `// nb-disable NB-ARCH-011 -- <reason>`.

## Public env prefixes are publication

Everything named `NEXT_PUBLIC_*` / `VITE_*` ships inside the JS bundle, readable in DevTools by anyone. `NB-ARCH-012` (warn) flags secret-sounding names (`SECRET`, `TOKEN`, `PRIVATE`, `PASSWORD`, `*_KEY`) behind a public prefix. A key that grants write/admin access must never be public; server-side secrets stay unprefixed.

## Server Actions are public endpoints

Every `"use server"` function compiles to an HTTP endpoint anyone can call. Treat each like a controller route:

1. **Authenticate** the caller,
2. **authorize** the operation,
3. **validate** the input (zod — typed-contracts),
4. return only what the caller may see.

Never assume "only my form calls this".

## Keep server code on the server

Add `import "server-only"` to data-layer modules that touch secrets — importing them from a Client Component then fails the build instead of leaking at runtime. React taint APIs are an extra experimental layer, not a substitute.

## Baseline

Set a Content-Security-Policy (via `next.config`/middleware or hosting), keep dependencies patched, and never log tokens or PII to the browser console.
