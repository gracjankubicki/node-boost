---
name: localization-workflow
description: Change user-facing strings through the project's i18next or Lingui extraction and catalog workflow.
---

# Localization Workflow

## When to use this skill

Use when changing user-facing text in a project with i18next/react-i18next or Lingui.

## Procedure

1. Match local namespaces/message descriptors and rich-text interpolation patterns; avoid new hard-coded strings.
2. Preserve pluralization and locale-aware date/number formatting.
3. Run repository-documented extraction and compilation/generation commands; do not hand-edit generated catalogs.
4. Keep tests deterministic by fixing the locale or asserting stable accessible semantics.
