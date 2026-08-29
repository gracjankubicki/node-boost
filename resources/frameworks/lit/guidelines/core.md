# Lit as an Astro Island

Use `@astrojs/lit` when a Lit component or custom element is the deliberate interactive boundary in an Astro page.

- Choose an explicit `client:*` directive and verify how the integration renders and hydrates the custom element.
- Distinguish HTML attributes from element properties: pass primitive values through the markup contract and keep complex values serializable and bounded.
- Keep Lit reactive controllers, shadow-DOM behavior, browser APIs, and event listeners inside the custom element. Do not import server-only modules into it.
- Preserve accessible names, keyboard behavior, and event contracts across the shadow boundary; document composed/custom events consumed by Astro or other islands.
- Test the server-visible element, hydration/upgrade behavior, shadow-DOM interaction, and failure or empty states exposed by the element.
