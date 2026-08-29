# Safe `set:html`

`set:html` inserts a string as markup. Astro does not make untrusted HTML safe automatically.

- Prefer normal Astro expressions and text nodes. They escape content and preserve a clearer template contract.
- Use `set:html` only for a value whose HTML provenance and allowed format are known, such as trusted build-time JSON-LD or sanitized CMS output.
- Sanitize untrusted or user-authored rich text with the repository's approved sanitizer before rendering. Keep the sanitizer policy close to the data boundary and test dangerous elements and attributes.
- Never interpolate request input, raw Markdown, query strings, or third-party HTML directly into `set:html`.
- Avoid constructing HTML with string concatenation. Keep JSON-LD serialization separate from markup and escape the exact embedding context.
- Do not suppress a warning merely because the page is statically generated; build-time content can still contain attacker-controlled data.
