# node-boost

node-boost is Boost for the Node ecosystem: a CLI and MCP guidance layer that installs project-specific AI instructions, agent skills, audit rules, and guard hooks. It targets React apps, with first-class support for Next.js and Vite React projects.

No telemetry. node-boost reads your local project, writes local files, and does not phone home.

## Quick Start

```sh
npm i -D @node-boost/node-boost
npx node-boost install
```

The npm package is published as `@node-boost/node-boost`; the installed CLI binary is `node-boost`.

Content-only extensions publish a versioned `node-boost.plugin.json` manifest. node-boost
resolves and validates that manifest without importing the plugin package entrypoint. The
intentionally small `@node-boost/node-boost/plugin` subpath remains available to plugin
authoring tools for validation and TypeScript types; installer, MCP, and audit internals are
not exposed.

The installer detects your stack and capabilities, writes `node-boost.json`, composes `.ai/guidelines/**` and `.ai/skills/**`, generates `.ai/docs/llms.txt`, and configures selected agents:

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
| `node-boost guard` | Run audit as a hard CI/agent gate; supports `--changed`, `--base`, and explicit paths. |
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
| `application_info` | Return detected stack, capabilities, package manager, packages, routes, and node-boost config summary. |
| `library_docs` | Return version-aware official documentation routes and exact package references. |
| `list_routes` | List Next app routes, including route handlers and parallel slots. |
| `doctor` | Run the same full checks as `node-boost doctor`. |
| `audit` | Run `node-boost audit --all` and return JSON. |
| `explain_finding` | Explain a rule such as `NB-ARCH-005`. |

## Library Documentation

`install` and `update` generate `.ai/docs/llms.txt` from detected dependency versions. Agents are instructed to prefer its version-matched routes over current-only upstream documentation.

The routing policy is conservative:

- Prefer an official exact- or major-version archive when one is available.
- Otherwise use the exact npm package version as the primary reference and list current upstream docs as secondary.
- Keep an upstream `llms.txt` as secondary when it describes only the current release.
- When `node_modules` is unavailable, label versions as inferred from declared ranges. Install dependencies and run `node-boost update` to pin resolved versions.

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

Hook payloads are validated against each agent's documented Stop protocol. Claude Code uses `stop_hook_active` and Cursor uses `loop_count` to prevent continuation loops; Codex uses `continue` and `stopReason`. The payload working directory selects the audited project only after absolute-directory validation.

By default, enabling `features.hooks` wires hooks for every configured agent. Set `hookAgents` to a subset such as `["codex"]` to enable blocking hooks only for those agents; an explicit empty list enables none.

Protocol references: [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code hooks](https://code.claude.com/docs/en/hooks), and [Cursor hooks](https://cursor.com/docs/hooks).

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
  "$schema": "./.ai/node-boost.schema.json",
  "version": 1,
  "generatedWith": "0.4.0",
  "stack": "next",
  "agents": ["claude-code", "codex", "cursor"],
  "plugins": ["@acme/node-boost-plugin"],
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
    "data-access-layer",
    { "name": "@acme/node-boost-plugin:service-layer", "variant": "strict" }
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

Release candidates are verified from a clean source checkout with `npm run smoke:pack`. The smoke builds through `prepack`, installs the resulting tarball in a temporary consumer, and runs CLI install/doctor from the packed binary.

## Content-only plugins

Plugins are installed as ordinary project dependencies and must be listed explicitly in
`plugins`. There is no auto-discovery or remote download. The package must export its static
manifest as `./node-boost.plugin.json`:

```json
{
  "name": "@acme/node-boost-plugin",
  "version": "1.0.0",
  "exports": {
    "./node-boost.plugin.json": "./node-boost.plugin.json"
  },
  "files": ["node-boost.plugin.json", "resources"]
}
```

```json
{
  "apiVersion": 1,
  "name": "@acme/node-boost-plugin",
  "architectures": [{
    "slug": "service-layer",
    "title": "Service layer",
    "stacks": ["next", "vite-react"],
    "resources": {
      "guideline": "resources/service-layer/guideline.md",
      "skill": "resources/service-layer/SKILL.md",
      "variants": {
        "strict": { "guideline": "resources/service-layer/strict.md" }
      }
    }
  }]
}
```

Plugin resource paths are package-relative, cannot traverse outside the package, and are
validated before node-boost writes any generated files. Plugins are content-only: executable
third-party audit rules are rejected. The plugin entrypoint is never imported; packages using
the executable `0.2.0` default-export contract receive a migration error instead.

## Interface stability

The CLI commands, their machine-readable reports, and MCP tools are the stable product surface.
Since `0.2.0`, the package root is intentionally not a JavaScript API. Since `0.3.0`, custom
architecture extensions use the static manifest contract. Authoring tools may use the dedicated
`@node-boost/node-boost/plugin` subpath, which exposes only content-plugin validation and types.
Imports from package internals are unsupported.

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

Generated `.ai/**`, including `.ai/docs/llms.txt`, agent files, and `node-boost.json` are intended to be committed in consumer projects.

## Roadmap

- third-party package guidelines beyond the current React stack,
- Angular,
- Vue,
- React Native,
- additional architecture patterns from the v1 backlog.
