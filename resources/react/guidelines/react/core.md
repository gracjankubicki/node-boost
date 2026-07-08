# React Core

- Components are pure functions of props/state — side effects live in event handlers, the data layer, or (rarely) effects that sync with external systems.
- Compute derived data during render; do not mirror props into state or chain `useEffect` + `setState` (see custom-hooks guideline).
- Lists need stable `key`s from the data, never array indexes for dynamic lists.
- Prefer composition (children/slots) over configuration props (see component-composition guideline).
- Keep state close to where it is used; escalate deliberately (see state-management guideline).
- Semantic HTML first: `<button>`, `<a>`, `<label>` — not clickable `<div>`s.
- Follow the version-specific React guideline in this directory — React idioms shift across majors and training data lags behind.
