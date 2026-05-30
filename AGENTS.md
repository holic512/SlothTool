# AGENTS.md

This file provides guidance to Codex when working with this repository.

## Project Snapshot

SlothTool is a TUI-first plugin manager.

- Root package: `@holic512/slothtool`
- Only official plugin kept in this repository: `@holic512/plugin-loc`
- Official plugins are installed from GitHub Release `.tgz` assets, not arbitrary npm package names entered by users
- Default product experience is full-screen Ink TUI
- Explicit CLI subcommands remain available for scripting and automation
- Current user-facing languages are `zh` and `en`

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

## Working Style

Use this default rhythm to keep changes small and verifiable:

1. Read the smallest relevant entrypoint, service, and test files first.
2. Put behavior changes in shared service modules before touching CLI or TUI wrappers.
3. Preserve the TUI-first product model unless the user explicitly asks to change it.
4. Run the narrowest useful smoke checks first, then `npm test` when shipped behavior changes.
5. Only sync versions and docs when the actual change scope requires it.

## Fast Change Map

- Root command dispatch and help: `bin/slothtool.js`, `lib/commands/*`, `test/root-cli.test.js`
- Root plugin lifecycle and execution: `lib/services/plugin-service.js`, `lib/registry.js`, `lib/settings.js`
- Root TUI: `lib/tui/root-tui.js`, `lib/i18n.js`
- Official plugin catalog: `lib/official-plugins.json`
- `loc` plugin entry, service, config, TUI, i18n: `plugins/loc/bin/loc.js`, `plugins/loc/lib/*`, `test/loc-cli.test.js`
- Plugin scaffold only: `plugins/template-basic/**`

`plugins/template-basic` is a scaffold reference. It is not a workspace package and is not published.

## Product Rules

These constraints should be preserved unless the user explicitly asks to change them:

1. TUI is the default user entry.
2. CLI is the underlying capability layer.
3. `slothtool` with no args launches the root full-screen TUI.
4. `slothtool <plugin>` with no extra args launches that plugin's default TUI.
5. Explicit CLI commands such as `install`, `list`, `update`, `config`, `run`, `self-update`, `uninstall`, and bulk flags remain supported.
6. Root and plugin TUI behavior should feel like an isolated full-screen page by using Ink `alternateScreen`.
7. Service logic must stay reusable by both CLI and TUI.

## Architecture Rules

### Service-first

- Put business logic in reusable service or use-case modules first.
- CLI and TUI should both consume the same underlying logic.
- Avoid implementing product logic directly inside Ink components.

### UI separation

- TUI files own rendering, navigation, keyboard handling, and high-level orchestration.
- CLI command files own argument parsing, output formatting, and exit-code handling.
- Shared services should not directly depend on Ink.

### Output discipline

- Service modules should not own terminal interaction patterns such as `process.exit()`, prompts, or ad hoc menu logic.
- Service modules may emit structured progress through reporter callbacks.
- CLI and TUI layers decide how to render service events.

### TUI conventions

- Prefer Ink over prompt-based flows.
- Use `alternateScreen: true` for full-screen experiences.
- Avoid nested TUI sessions; exit the current TUI before launching a plugin TUI or CLI child process.
- Preserve the root TUI page model unless the user explicitly asks to change product behavior:
  - `Home`
  - `Run`
  - `Install`
  - `Update`
  - `Settings`

### I18N and persistence

- User-facing copy changes should update the corresponding `i18n.js` module for both `zh` and `en`.
- Keep persistence rules centralized in `lib/registry.js`, `lib/settings.js`, or the plugin config modules instead of scattering file writes.

## Plugin Contract

Plugins should keep exposing `slothtool.ui` metadata in `package.json`.

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

- Keep backward compatibility with legacy `interactive` and `interactiveFlag` when touching root plugin resolution logic.
- New official plugins and scaffold work should follow `slothtool.ui`.
- A plugin that supports TUI should support explicit `--tui`.
- No-arg plugin entry should default to TUI unless product requirements change.

## Validation Matrix

Prefer targeted checks that match the files you changed.

### Root manager changes

```bash
node --check bin/slothtool.js
node --check lib/services/plugin-service.js
node --check lib/tui/root-tui.js
node bin/slothtool.js --help
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
```

### `loc` plugin changes

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
node plugins/loc/bin/loc.js config show
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
```

### Packaging and release-path changes

```bash
npm pack --dry-run
cd plugins/loc && npm pack --dry-run
```

### Full regression pass

```bash
npm test
```

## Test Conventions

- Tests use `node:test`; keep new coverage lightweight and behavior-oriented.
- Prefer isolated temporary `HOME` directories for persistence-related tests.
- Prefer existing TUI smoke hooks over brittle interactive automation when only boot and exit paths need validation.
- When adding a regression, cover the service or command boundary that actually failed instead of snapshotting full terminal output.

## Versioning Rules

- Docs-only, tests-only, or `AGENTS.md`-only changes do not require a version bump.
- Root shipped-behavior changes require updating the root `package.json` version and keeping `package-lock.json` in sync.
- `plugins/loc` shipped-behavior changes require updating `plugins/loc/package.json` and keeping the workspace section in `package-lock.json` in sync.
- If one change modifies both the manager and the official plugin, bump both versions in the same change set.
- Before creating a commit that changes any shipped package version, stop and confirm the intended version increment with the user. The user decides how far to bump the version; do not choose the increment unilaterally.
- Do not rely on workflow runs alone; releases are gated by whether the version tag already exists.
- Before finishing work that changes shipped code, verify the next release tags implied by the versions are new:
  - core: `slothtool-v<root-version>`
  - plugin: `plugin-loc-v<plugin-version>`

## Release Model

- Root package release workflow: `.github/workflows/release-core.yml`
- Plugin release workflow: `.github/workflows/release-plugins.yml`
- Official plugin catalog: `lib/official-plugins.json`

The core release workflow is path-filtered on root package files and docs, but an actual publish still depends on a new root version tag.

## Documentation Sync Rules

- Update `README.md` when install steps, user commands, or user-visible behavior changes.
- Update `LOCAL_BUILD_GUIDE.md` when local setup or validation workflow changes.
- Update `PLUGIN_DEVELOPMENT.md` when plugin contract or scaffold guidance changes.
- Keep `AGENTS.md` aligned with actual file layout, command surface, and release rules.
- Do not expand doc updates beyond the real scope of the change.

## Important Notes

- Do not reintroduce deleted plugin packages unless explicitly requested.
- Keep `slothtool install` restricted to built-in official aliases.
- Treat `plugins/template-basic` as scaffold-only, not a published package.
- If you touch root or plugin entrypoints, preserve executable bits on:
  - `bin/slothtool.js`
  - `plugins/loc/bin/loc.js`
  - `plugins/template-basic/bin/mytool.js`
