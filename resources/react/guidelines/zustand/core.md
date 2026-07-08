# Zustand Core

- The store holds **client-owned** state only: UI preferences, drafts, selections. Server data lives in react-query — writing fetched results into the store creates a second source of truth (flagged by `NB-ARCH-009`).
- Small, focused stores per concern beat one global store; colocate a feature's store inside the feature.
- Select narrowly: `useStore((s) => s.sidebarOpen)` — subscribing to the whole store re-renders on every change.
- Actions live inside the store definition (`set`/`get`), components call them — no external mutation of store state.
- Persist only what genuinely survives sessions (`persist` middleware) and version the storage schema.
- Before adding to the store, walk the ladder: `useState` → URL → Context → store (see state-management guideline).
