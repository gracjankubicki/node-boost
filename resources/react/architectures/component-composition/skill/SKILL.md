---
name: component-composition
description: Design component APIs with children, slots and compound components instead of boolean-prop configuration.
---

# Component Composition

## When to use this skill

Use when creating a reusable component, when a component sprouts its third boolean prop, or when tempted to drill props through several layers.

## Procedure

1. Start with `children`. Add named slots (`header={<... />}`) when multiple regions are needed.
2. Related pieces sharing state → compound components (`Card.Header` reading the parent's context).
3. Visual variants → cva variant prop; structural differences → separate components or slots, not booleans.
4. Shared UI in `components/ui/` receives everything via props — no domain imports.
5. Prop drilling → compose the subtree at the level where the data lives; escalate to Context only for genuinely global client state.
6. Use semantic elements (`button`, `a`, `nav`, `label`); wire `ref` as a plain prop (React 19 — no `forwardRef`).
