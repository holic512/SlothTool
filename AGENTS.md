# AGENTS.md

This file provides guidance to Codex when working with this repository.

## Project Overview

SlothTool is a TUI-first plugin manager.

- Root package: `@holic512/slothtool`
- Only official plugin kept in this repository: `@holic512/plugin-loc`
- Official plugins are installed from GitHub Release assets, not from arbitrary npm names entered by users
- Default product experience is full-screen Ink TUI
- Explicit CLI subcommands remain available for scripting and automation

User data is stored under:

- `~/.slothtool/settings.json`
- `~/.slothtool/registry.json`
- `~/.slothtool/plugins/`
- `~/.slothtool/plugin-configs/`

## Runtime Baseline

- Node.js `>=22`
- npm `>=10`
- Root package and workspace plugin code use ESM (`"type": "module"`)
- Root TUI and plugin TUIs use `ink`

Do not add new CommonJS modules unless explicitly requested.

## Product Rules

These are the current product-level constraints and should be preserved unless the user explicitly asks to change them:

1. TUI is the default user entry.
2. CLI is the underlying capability layer.
3. `slothtool` with no args launches the root full-screen TUI.
4. `slothtool <plugin>` with no extra args launches that plugin's default TUI.
5. Explicit CLI commands such as `install`, `list`, `update`, `config`, `run` remain supported.
6. Root and plugin TUI behavior should feel like an isolated full-screen page by using Ink `alternateScreen`.
7. Service logic must be reusable by both CLI and TUI.

## Architecture Rules

### Service-first

- Put business logic in reusable service/use-case modules first.
- CLI and TUI should both consume the same underlying logic.
- Avoid implementing product logic directly inside Ink components.

### UI separation

- TUI files are responsible for rendering, navigation, keyboard handling, and high-level orchestration.
- CLI command files are responsible for argument parsing, output formatting, and exit-code handling.
- Shared services should not directly depend on Ink.

### Output discipline

- Service modules should not own terminal interaction patterns such as `process.exit()`, `prompts`, or ad hoc menu logic.
- Service modules may emit structured progress through reporter callbacks.
- CLI/TUI layers decide how to render service events.

### TUI conventions

- Prefer Ink over prompt-based flows.
- Use `alternateScreen: true` for full-screen experiences.
- Avoid nested TUI sessions; exit the current TUI before launching a plugin TUI/CLI child process.
- Preserve the root TUI page model unless explicitly changing product behavior:
  - `Home`
  - `Install`
  - `Plugins`
  - `Run`
  - `Settings`
  - `Danger Zone`

## Repository Structure

```text
SlothTool/
├── bin/                     # Root CLI entry
├── lib/
│   ├── commands/           # CLI wrappers over shared services
│   ├── services/           # Shared root business logic
│   ├── tui/                # Root Ink TUI
│   ├── i18n.js
│   ├── plugin-manager.js   # Compatibility re-export layer
│   ├── registry.js
│   ├── settings.js
│   └── utils.js
├── plugins/
│   ├── loc/                # Official plugin workspace
│   └── template-basic/     # Scaffold only
├── test/                   # node:test smoke/regression tests
├── README.md
├── PLUGIN_DEVELOPMENT.md
├── LOCAL_BUILD_GUIDE.md
└── package.json
```

## Current Key Files

### Root package

- `bin/slothtool.js`: root CLI/TUI dispatch entry
- `lib/services/plugin-service.js`: shared plugin lifecycle and execution service
- `lib/tui/root-tui.js`: root Ink TUI
- `lib/commands/*`: explicit CLI command wrappers
- `lib/registry.js`: installed plugin registry persistence
- `lib/settings.js`: global settings persistence
- `lib/i18n.js`: root CLI/TUI copy

### Official plugin

- `plugins/loc/bin/loc.js`: plugin entrypoint
- `plugins/loc/lib/service.js`: shared loc CLI/TUI logic
- `plugins/loc/lib/tui.js`: loc Ink TUI
- `plugins/loc/lib/counter.js`: line-counting engine
- `plugins/loc/lib/config.js`: loc config persistence
- `plugins/loc/lib/i18n.js`: loc CLI/TUI copy

### Scaffold

- `plugins/template-basic/` is a copyable scaffold directory
- it demonstrates the current default pattern: no-arg TUI + explicit CLI commands
- it is not published and not included in release automation

## Plugin Contract

Plugins should expose `slothtool.ui` metadata in `package.json`.

Current contract:

```json
{
  "slothtool": {
    "interactive": true,
    "interactiveFlag": "-i",
    "ui": {
      "cli": true,
      "tui": true,
      "defaultMode": "tui",
      "tuiFlag": "--tui",
      "compatFlags": ["-i", "--interactive"]
    }
  }
}
```

Rules:

- Keep backward compatibility with legacy `interactive` / `interactiveFlag` when touching root plugin resolution logic.
- New official plugins and scaffold work should follow `slothtool.ui`.
- A plugin should support explicit `--tui` if it supports TUI mode.
- No-arg plugin entry should default to TUI unless product requirements change.

## Development Commands

### Setup

```bash
npm install
npm link
```

### Core checks

```bash
slothtool --help
slothtool
node --check bin/slothtool.js
node --check lib/services/plugin-service.js
node --check lib/tui/root-tui.js
```

### Plugin checks

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js
node plugins/loc/bin/loc.js .
node plugins/loc/bin/loc.js --tui
```

### Tests

```bash
npm test
```

Useful smoke hooks for non-interactive validation:

```bash
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
SLOTHTOOL_TEMPLATE_TUI_TEST_ACTION=exit node plugins/template-basic/bin/mytool.js
```

## Release Model

- Root package release workflow: `.github/workflows/release-core.yml`
- Plugin release workflow: `.github/workflows/release-plugins.yml`
- Official plugin catalog: `lib/official-plugins.json`

## Versioning Rules

- Any code change that affects shipped behavior must include an explicit version update decision.
- For root manager changes, update the root `package.json` version and keep `package-lock.json` in sync.
- For `plugins/loc` changes, update `plugins/loc/package.json` and keep the workspace section in `package-lock.json` in sync.
- If one change modifies both the manager and the official plugin, bump both versions in the same change set.
- Do not rely on workflow runs alone; releases are gated by whether the version tag already exists.
- Before finishing work that changes shipped code, verify the next release tags implied by the versions are new:
  - core: `slothtool-v<root-version>`
  - plugin: `plugin-loc-v<plugin-version>`

## Important Notes

- Do not reintroduce deleted plugin packages unless explicitly requested.
- Keep `slothtool install` restricted to built-in official aliases.
- Treat `plugins/template-basic` as scaffold-only, not a published package.
- If you touch root or plugin entrypoints, preserve executable bits on:
  - `bin/slothtool.js`
  - `plugins/loc/bin/loc.js`
  - `plugins/template-basic/bin/mytool.js`
- When updating docs or architecture, keep `README.md`, `LOCAL_BUILD_GUIDE.md`, `PLUGIN_DEVELOPMENT.md`, and `AGENTS.md` aligned.
