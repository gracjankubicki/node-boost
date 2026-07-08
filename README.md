# node-boost

node-boost is Boost for the Node ecosystem: a CLI and MCP guidance layer that installs project-specific AI instructions, agent skills, audit rules, and guard hooks. v0.1 targets React apps, with first-class support for Next.js and Vite React projects.

No telemetry. node-boost reads your local project, writes local files, and does not phone home.

## Quick Start

```sh
npm i -D node-boost
npx node-boost install
```

The installer detects your stack, writes `node-boost.json`, composes `.ai/guidelines/**` and `.ai/skills/**`, and configures selected agents:

- Claude Code: `CLAUDE.md`, `.claude/skills/**`, `.mcp.json`, optional `.claude/settings.json` hooks.
- Codex: `AGENTS.md`, `.agents/skills/**`, `.codex/config.toml`, optional `.codex/hooks.json`.
- Cursor: `.cursor/rules/node-boost.mdc`, `.cursor/mcp.json`, optional `.cursor/hooks.json`.

## CLI

| Command | Purpose |
| --- | --- |
| `node-boost install` | Generate guidelines, skills, config, MCP, and optional hook files. |
| `node-boost update` | Regenerate from `node-boost.json` without prompts. |
| `node-boost doctor` | Check config, generated resources, agent files, hooks, overrides, and TS strictness. |
| `node-boost audit` | Scan source files against enabled architecture rules. |
| `node-boost guard` | Run `audit --changed --agent` as a hard CI/agent gate. |
| `node-boost explain NB-ARCH-005` | Explain a finding and link it back to the generated guideline. |
| `node-boost mcp` | Start the MCP server over stdio. |

Machine-readable commands use `--agent`:

```sh
npx node-boost audit --all --agent
npx node-boost doctor --agent
```

## MCP Tools

| Tool | Purpose |
| --- | --- |
| `application_info` | Return detected stack, package manager, packages, routes, and node-boost config summary. |
| `list_routes` | List Next app routes, including route handlers and parallel slots. |
| `doctor` | Run the same full checks as `node-boost doctor`. |
| `audit` | Run `node-boost audit --all` and return JSON. |
| `explain_finding` | Explain a rule such as `NB-ARCH-005`. |

## Architecture Patterns

| Pattern | What it protects |
| --- | --- |
| `feature-modules` | Feature boundaries. Variant `public-api` allows imports through `index.ts`; variant `forbid` blocks all cross-feature imports. |
| `server-first-components` | Next app entries stay server-first; client code moves into child boundaries. |
| `data-access-layer` | Components call data functions or query hooks instead of raw network clients. |
| `typed-contracts` | Env and JSON boundaries are centralized and validated. |
| `state-management` | Client stores hold UI state, not fetched server state. |
| `custom-hooks` | Hooks are extracted only for real reuse, readability, or testability. |
| `component-composition` | UI composition stays explicit and testable. |
| `styling-tailwind` | Tailwind version-specific conventions stay current. |
| `testing-strategy` | Tests target user-visible behavior and high-risk boundaries. |
| `error-loading-boundaries` | Async Next segments have loading/error boundaries. |
| `secure-by-default` | Public env names and HTML injection are checked. |
| `modern-typescript` | Strict TS and no explicit `any` in source. |
| `ui-states` | Loading, empty, error, disabled, and optimistic states are represented deliberately. |

## Audit And Guard

`audit` reads enabled architectures from `node-boost.json`.

```sh
npx node-boost audit --all
npx node-boost audit --changed --agent
npx node-boost audit --base origin/main --agent
```

Suppress a finding only with a reason:

```ts
// nb-disable NB-ARCH-005 -- legacy SDK must be wrapped in a follow-up
```

Suppression without `-- reason` is reported as `NB-META-001`.

## Hooks

When `features.hooks` is enabled, node-boost wires `guard --hook <agent>` into each selected agent:

- Claude Code: `Stop` hook in `.claude/settings.json`.
- Codex: `Stop` hook in `.codex/hooks.json`.
- Cursor: `stop` hook in `.cursor/hooks.json`.

The hook audits changed files. Error findings block or continue the agent in that agent's native protocol. Disable hooks by setting:

```json
{
  "features": {
    "hooks": false
  }
}
```

Then run:

```sh
npx node-boost update
```

## Configuration

`node-boost.json` is the source of truth:

```json
{
  "version": 1,
  "generatedWith": "0.1.0",
  "stack": "next",
  "agents": ["claude-code", "codex", "cursor"],
  "features": {
    "guidelines": true,
    "skills": true,
    "mcp": true,
    "architecture": true,
    "hooks": false
  },
  "architectures": [
    { "name": "feature-modules", "boundary": "public-api" },
    "server-first-components",
    "data-access-layer"
  ],
  "audit": {
    "exclude": [],
    "rules": {
      "NB-ARCH-007": "off",
      "NB-ARCH-002": "warn"
    },
    "ruleOptions": {
      "NB-ARCH-005": {
        "dataLayerGlobs": ["**/api/**", "src/orval/**"]
      }
    }
  }
}
```

Project overrides live under `.node-boost/**` and shadow built-in resources during `install` and `update`.

## CI

Example pull request guard:

```yaml
name: Node Boost Guard

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.0
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6.4.0
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npx node-boost guard --base origin/main
```

This repository also ships a package CI workflow in `.github/workflows/ci.yml`.

## Git Ignore

Keep implementation planning local unless your team wants to publish it:

```gitignore
implementation-plans/
```

Generated `.ai/**`, agent files, and `node-boost.json` are intended to be committed in consumer projects.

## Roadmap

- third-party package guidelines beyond the current React stack,
- Angular,
- Vue,
- React Native,
- additional architecture patterns from the v1 backlog.
