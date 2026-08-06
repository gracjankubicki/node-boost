# Mantine

- Mantine is the project's component system. Prefer its components, theme tokens, form/overlay/notification primitives, and established shared wrappers over introducing Tailwind/CVA conventions.
- Match the installed major's APIs and the repository's CSS Modules/styles conventions.
- Preserve provider composition, portals, modal management, dates, and accessibility behavior from nearby code.
- Extend shared domain-agnostic wrappers only when multiple consumers need a stable semantic API; do not recreate Mantine primitives without a concrete gap.
