# AGENTS.md

Concise repo rules for Codex working on SlothTool.

## 1. Project Facts

- SlothTool is a TUI-first plugin manager.
- Root package: `@holic512/slothtool`
- The current built-in official plugin catalog exposed by the root manager contains `@holic512/plugin-loc` and `@holic512/plugin-image-compress`.
- `plugins/image-compress` ships as an official plugin workspace with a dedicated multi-platform release workflow and target-aware asset installation.
- Official plugins are installed from GitHub Release `.tgz` assets, not arbitrary npm names.
- Runtime baseline:
  - Node.js `>=22`
  - npm `>=10`
  - ESM only
  - Root and plugin TUIs use `ink`
- User data:
  - `~/.slothtool/settings.json`
  - `~/.slothtool/registry.json`
  - `~/.slothtool/plugins/`
  - `~/.slothtool/plugin-configs/`

## 2. Product Invariants

- TUI is the default product entry.
- CLI remains the capability layer for scripting and automation.
- `slothtool` with no args launches the root full-screen TUI.
- `slothtool <plugin>` with no extra args launches that plugin's default TUI.
- Explicit CLI commands must keep working: `install`, `list`, `update`, `config`, `run`, `self-update`, `uninstall`, bulk flags.
- Root TUI page model is:
  - `Home`
  - `Run`
  - `Install`
  - `Update`
  - `Uninstall`
  - `Settings`
- Root `Update` page is a two-step flow: check first, then update.
- If a plugin is launched from the root TUI, plugin exit returns to the root TUI and restores prior page/selection.
- Direct CLI plugin launches return to the terminal, not the manager TUI.
- Root and plugin TUIs should feel like isolated full-screen pages via `alternateScreen: true`.

## 3. Architecture Rules

- Put behavior in reusable service modules first; CLI and TUI both consume them.
- Do not put core product logic directly inside Ink components.
- TUI owns rendering, navigation, keyboard handling, and high-level orchestration.
- CLI owns arg parsing, output formatting, and exit-code handling.
- Shared services must not depend on Ink.
- Service modules must not own `process.exit()`, prompts, or ad hoc menu flows.
- Persistence stays centralized in `lib/registry.js`, `lib/settings.js`, or plugin config modules.
- User-facing copy changes must update both `zh` and `en`.
- Do not add CommonJS unless explicitly requested.

## 4. Plugin Contract

Plugins should expose `slothtool.ui` in `package.json`:

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

- Keep backward compatibility with legacy `interactive` and `interactiveFlag`.
- TUI-capable plugins should support explicit `--tui`.
- No-arg plugin entry defaults to TUI unless product requirements change.

Cross-platform official plugin rules:

- If a plugin needs target-specific release assets, declare `assetStrategy: "platform-target"` in `lib/official-plugins.json`.
- Declare explicit `supportedTargets` in `lib/official-plugins.json` using normalized targets such as `macos-arm64`, `macos-amd64`, `linux-amd64`, `linux-arm64`, `windows-amd64`.
- Release asset names must follow `<assetNamePrefix><version>-<target>.tgz`.
- Release archives must contain a runnable plugin root either directly at archive root or under the standard `package/` directory produced by `npm pack`.
- If the plugin ships a prebuilt backend, place it under `backend/dist/`, and keep the Node wrapper able to prefer that binary at runtime.

## 5. Fast Change Map

- Root command dispatch/help: `bin/slothtool.js`, `lib/commands/*`, `test/root-cli.test.js`
- Root services/persistence: `lib/services/plugin-service.js`, `lib/registry.js`, `lib/settings.js`
- Root TUI/i18n: `lib/tui/root-tui.js`, `lib/i18n.js`
- Official plugin catalog: `lib/official-plugins.json`
- `loc` plugin: `plugins/loc/bin/loc.js`, `plugins/loc/lib/*`, `test/loc-cli.test.js`
- `image-compress` plugin: `plugins/image-compress/bin/image-compress.js`, `plugins/image-compress/lib/*`, `plugins/image-compress/backend/**`, `test/image-compress-plugin.test.js`
- `plugins/template-basic/**` is scaffold-only, not a published workspace package.

## 6. Validation

Prefer the narrowest useful checks first, then `npm test` for shipped behavior changes.

Root manager:

```bash
node --check bin/slothtool.js
node --check lib/services/plugin-service.js
node --check lib/tui/root-tui.js
node bin/slothtool.js --help
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
```

`loc` plugin:

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
node plugins/loc/bin/loc.js config show
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
```

Packaging:

```bash
npm pack --dry-run
cd plugins/loc && npm pack --dry-run
cd plugins/image-compress/backend && GOCACHE=$(mktemp -d) go test ./...
node --test test/image-compress-plugin.test.js
node --test test/official-plugin-selection.test.js
```

Full regression:

```bash
npm test
```

Testing conventions:

- Use `node:test`
- Prefer isolated temporary `HOME`
- Prefer existing TUI smoke hooks over brittle interactive automation
- Regress at the failing service or command boundary, not by snapshotting full terminal output

## 7. Versioning And Release

- Docs-only, tests-only, or `AGENTS.md`-only changes do not require a version bump.
- Root shipped behavior changes require bumping root `package.json` and syncing `package-lock.json`.
- `plugins/loc` shipped behavior changes require bumping `plugins/loc/package.json` and its workspace lock entry.
- If a change ships both core and the official plugin, bump both in the same change set.
- Before any commit that changes a shipped package version, confirm the intended version increment with the user. Do not choose the bump unilaterally.
- Before finishing shipped code changes, verify release tags are still free:
  - core: `slothtool-v<root-version>`
  - plugin: `plugin-loc-v<plugin-version>`
  - image-compress plugin: `plugin-image-compress-v<plugin-version>`
- Release workflows:
  - core: `.github/workflows/release-core.yml`
  - plugins: `.github/workflows/release-plugins.yml`
  - image-compress: `.github/workflows/release-image-compress.yml`

## 8. Docs And Safety

- Update `README.md` when user-visible behavior, commands, or install steps change.
- Update `LOCAL_BUILD_GUIDE.md` only when local setup or validation workflow changes.
- Update `PLUGIN_DEVELOPMENT.md` only when plugin contract or scaffold guidance changes.
- Keep `AGENTS.md` aligned with actual repo behavior.
- Do not reintroduce deleted plugin packages unless explicitly requested.
- Keep `slothtool install` restricted to built-in official aliases.
- Preserve executable bits on:
  - `bin/slothtool.js`
  - `plugins/loc/bin/loc.js`
  - `plugins/template-basic/bin/mytool.js`
