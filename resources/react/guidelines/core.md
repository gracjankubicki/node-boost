# Node Boost Core

Baseline for AI-assisted work in this repository. Package guidelines are composed from detected dependencies; architecture guidelines are explicitly selected or inferred from concrete capabilities. Local `AGENTS.md`, README instructions, scripts, and nearby code remain authoritative project conventions.

## Working rules

- Read local instructions and package scripts, then match the detected stack and versions (use `application_info` when Node Boost is installed). Version-specific guidelines override generic knowledge, but a framework version alone does not prove that an optional compiler or feature flag is enabled.
- Follow the enabled architecture guidelines (indexed in `node-boost.md`); the `audit`/`guard` commands enforce their rules (`NB-ARCH-xxx`). Use `explain <ID>` when a finding is unclear.
- Suppressing a finding requires a reason: `// nb-disable NB-ARCH-xxx -- <why>`. Unreasoned suppressions are flagged.
- After completing changes, use the repository's documented validation commands. When Node Boost is installed, also run `node-boost audit --changed` (or rely on its Stop hook).

## Repository hygiene

- Do not leave dead code: unused exports, files and dependencies are context noise for both humans and agents. `knip` finds them — prefer removing over commenting out.
- Keep `node-boost.json` and generated `.ai/**` files committed; regenerate with `node-boost update` after dependency upgrades (`doctor` detects drift).
