---
name: astro-safe-html
description: Review and implement trusted HTML rendering through Astro's set:html directive.
---

# Safe HTML in Astro

## When to use this skill

Use when adding, reviewing, or fixing `set:html` or any HTML string rendered by an Astro component.

## Procedure

1. Prefer escaped text and normal Astro markup; use `set:html` only when markup is required.
2. Trace the value to its source and classify it as trusted generated markup, sanitized content, or untrusted input.
3. Sanitize untrusted rich text with the repository-approved policy before rendering and test dangerous tags and attributes.
4. Keep JSON-LD serialization separate from HTML fragments and escape for the actual embedding context.
5. Treat static generation as an optimization, not a sanitizer, and never silence a finding without documenting the provenance.
