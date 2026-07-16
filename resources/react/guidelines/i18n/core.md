# Localization

- User-facing strings follow the repository's installed i18next/react-i18next or Lingui workflow; avoid hard-coded text where nearby code translates it.
- Preserve namespaces/message descriptors, interpolation, pluralization, rich-text placeholders, and locale-aware date/number formatting.
- Run the documented extraction and catalog compile/generation commands. Do not hand-edit generated catalogs when the project forbids it.
- Tests should avoid brittle assertions tied to a developer locale unless the locale is explicitly fixed.
