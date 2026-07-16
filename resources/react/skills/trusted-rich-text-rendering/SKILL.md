---
name: trusted-rich-text-rendering
description: Render CMS or API HTML only after establishing provenance and applying a runtime-compatible sanitizer policy.
---

# Trusted Rich Text Rendering

## When to use this skill

Use for `dangerouslySetInnerHTML`, HTML-to-React parsers, CMS/article bodies, or `NB-ARCH-011` findings.

## Procedure

1. Establish provenance: static literal, verified write-time sanitization, trusted internal editor, or arbitrary user/CMS content.
2. Remember that parsers such as `html-react-parser` do not sanitize. Prefer JSX for structured/plain data.
3. Sanitize dynamic HTML with an approved runtime-compatible dependency and an allowlist for elements, attributes, and URL schemes.
4. Test scripts, event attributes, malformed markup, dangerous URLs, iframes, and link/image policies.
5. Document a verified upstream guarantee with a reasoned suppression; never trust a helper solely because its name contains `sanitize`.
