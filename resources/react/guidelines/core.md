# Node Boost Core

Baseline for AI-assisted work in this repository. Guidelines in `.ai/guidelines/` are composed from the packages actually installed — trust them over training-data habits, which are often a major version stale.

## Working rules

- Match the project's detected stack and versions (see the `application_info` MCP tool) before writing code; version-specific guidelines override generic knowledge.
- Follow the enabled architecture guidelines (indexed in `node-boost.md`); the `audit`/`guard` commands enforce their rules (`NB-ARCH-xxx`). Use `explain <ID>` when a finding is unclear.
- Suppressing a finding requires a reason: `// nb-disable NB-ARCH-xxx -- <why>`. Unreasoned suppressions are flagged.
- After completing changes, run `node-boost audit --changed` (or rely on the installed Stop hook) and fix findings before handing back.

## Repository hygiene

- Do not leave dead code: unused exports, files and dependencies are context noise for both humans and agents. `knip` finds them — prefer removing over commenting out.
- Keep `node-boost.json` and generated `.ai/**` files committed; regenerate with `node-boost update` after dependency upgrades (`doctor` detects drift).
