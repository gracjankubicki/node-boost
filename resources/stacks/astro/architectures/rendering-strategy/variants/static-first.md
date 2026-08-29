# Rendering Strategy: Static-first

Prefer prerendered HTML for public content, documentation, marketing pages, and other routes whose output is independent of the request.

- Keep request-specific behavior behind a client island or a separate on-demand endpoint.
- Validate all build-time content and do not embed private environment values in generated HTML.
- Rebuild or revalidate deliberately when content changes; do not imply live freshness from a static route.
- Add a focused on-demand route when cookies, sessions, authorization, or request headers become part of the output.
