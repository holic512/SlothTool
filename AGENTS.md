# AGENTS.md

Concise repo rules for Codex working on SlothTool.

## 1. Project Facts

- SlothTool is a TUI-first plugin manager.
- Root package: `@holic512/slothtool`
- The current built-in official plugin catalog exposed by the root manager contains `@holic512/plugin-loc`, `@holic512/plugin-image-compress`, `@holic512/plugin-gstore`, `@holic512/plugin-pzip`, and `@holic512/plugin-slothvault`.
- `plugins/image-compress` ships as an official plugin workspace with a dedicated multi-platform release workflow and target-aware asset installation.
- `plugins/gstore` ships as an official CLI + TUI plugin workspace for syncing SlothTool settings, plugin configs, and data through an isolated Git repository cache and a GitHub private repository via local `git` and `gh`.
- Root and official plugin TUIs share the scaffold/loc shell: high-contrast tabs, divider, responsive rounded panels, and a bottom status/keymap bar.
- `plugins/pzip` ships as an official CLI + TUI plugin workspace for recursive ZIP packaging with configurable macOS/build/Git metadata filtering and nested `.gitignore` support.
- `plugins/slothvault` ships a Deployment and Skill manager with one executable. SlothVault independently releases Skill and Deployment packages; `slothtool install/update slothvault` manages only the UI. Independent package services manage each Vault package explicitly through its Tab or CLI, without MCP Client packages, Profiles, command registration or agent credential storage. Agents connect directly through native MCP configuration.
- Root alias migration moves only the SlothVault plugin identity, registry entry, and installed directory; legacy Profile/history paths are cleanup-only and must never be read or migrated back into active configuration.
- Official plugins are installed from GitHub Release `.tgz` assets or package-name-validated offline archives, never arbitrary npm names.
- `slothtool bundle <alias>` creates an offline archive only from an installed official plugin with complete runtime dependencies.
- Runtime baseline:
  - Node.js `>=22`
  - npm `>=10`
  - ESM only
  - Root and plugin TUIs use `ink`
- User data:
- `~/.pipker/slothtool/settings.json`
- `~/.pipker/slothtool/registry.json`
- `~/.pipker/slothtool/data/`
- `~/.pipker/slothtool/plugins/`
- `~/.pipker/slothtool/plugin-configs/`
- `~/.codex/skills/slothvault-mcp` and `~/.claude/skills/slothvault-mcp` (optional links installed only for detected agents by the SlothVault multifunction plugin; configurable through `CODEX_HOME` and `CLAUDE_CONFIG_DIR`)

## 2. Product Invariants

- TUI is the default product entry.
- The SlothVault manager always enters local Overview without reading MCP configuration or connecting. It preserves the action menu and scrollable right-side progress/results. It shows each component version and structured state for the selected managed deployment; its CLI and TUI use the Vault Deployment Package through the JSON-line event bridge.
- CLI remains the capability layer for scripting and automation.
- `slothtool` with no args launches the root full-screen TUI.
- `slothtool <plugin>` with no extra args launches that plugin's default TUI.
- Explicit CLI commands must keep working: `install`, offline `install --file`, `bundle`, `list`, `update`, `config`, `run`, `self-update`, `uninstall`, bulk flags.
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

Offline official plugin rules:

- `install <alias> --file <archive.tgz>` remains restricted to built-in official aliases and must validate the archive package name.
- Offline archives should use the npm-pack-compatible `package/` root layout.
- A self-contained archive must include production `node_modules`; otherwise installation may only use `npm install --omit=dev --offline` and must never silently fetch from the network. The SlothVault UI bundle is intentionally UI-only; installing it never downloads Vault packages. Each external package is explicitly installed later through its own service.
- `bundle <alias>` must refuse to create an incomplete dependency-bearing archive.
- Offline installations record `sourceType: "offline-archive"` in the registry.

Cross-platform official plugin rules:

- If a plugin needs target-specific release assets, declare `assetStrategy: "platform-target"` in `lib/official-plugins.json`.
- Declare explicit `supportedTargets` in `lib/official-plugins.json` using normalized targets such as `macos-arm64`, `macos-amd64`, `linux-amd64`, `linux-arm64`, `windows-amd64`.
- Release asset names must follow `<assetNamePrefix><version>-<target>.tgz`.
- Release archives must contain a runnable plugin root either directly at archive root or under the standard `package/` directory produced by `npm pack`.
- If the plugin ships a prebuilt backend, place it under `backend/dist/`, and keep the Node wrapper able to prefer that binary at runtime.

SlothVault multifunction package rules:

- Skill install and update resolve the official Release directly, retain one stable active directory, verify links and remove temporary payloads, with rollback on failure. Preserve referenced historical/custom sources.
- Keep Skill content in the Vault Skill Package. SlothTool manages detected Codex or Claude Code links locally and must not duplicate Skill content or import Vault business modules.
- Detect Codex through its config directory or `codex` executable and target `$CODEX_HOME/skills` (default `~/.codex/skills`); detect Claude Code through its config directory or `claude` executable and target `$CLAUDE_CONFIG_DIR/skills` (default `~/.claude/skills`). Do not create new links under `~/.agents/skills`.
- Skill conflict replacement requires explicit confirmation and may delete only fixed detected-agent Skill targets. Skill update preserves custom targets; install replacement still requires explicit authorization. Skill uninstall may remove only current or verified legacy managed links.
- Do not add an MCP Client runtime, Python venv/pip installation, standalone `slothvault-mcp` command, Profile editor or remote MCP inspector to this plugin. Keep native agent credentials and configuration outside SlothTool.
- Retired MCP CLI commands return native connection guidance without reading credentials or starting old scripts. Legacy aliases route to the main manager; package validation requires only the named `slothvault` executable while rejecting former MCP-only package names.

- Uninstall defaults to retaining configuration/history in single CLI and all TUI flows; explicit purge removes only fixed plugin-owned paths. Legacy `--uninstall-all` without a data flag keeps its complete-purge meaning. Noninteractive purge or bulk uninstall requires `--yes` and a preview.
- SlothVault uninstall cleans links before their sources even if Python/packages are missing, and always preserves deployed applications, containers, databases, Nginx and certificates. Old-data cleanup protects active/reference paths, clears only legacy SlothTool MCP configuration/history and verified retired Client payloads/commands, never touches native agent MCP configuration, and never runs Python.
- Canonical standalone helpers live in `lib/services/{release-client,network-helper,slothvault-paths,slothvault-storage}.js`; run `npm run sync:slothvault-helpers` after edits and `npm run check:slothvault-helpers` before packaging. Plugin copies must work without the root installation.

## 5. Fast Change Map

- Root command dispatch/help: `bin/slothtool.js`, `lib/commands/*`, `test/root-cli.test.js`
- Root services/persistence: `lib/services/plugin-service.js`, `lib/registry.js`, `lib/settings.js`
- Root TUI/i18n: `lib/tui/root-tui.js`, `lib/i18n.js`
- Official plugin catalog: `lib/official-plugins.json`
- `loc` plugin: `plugins/loc/bin/loc.js`, `plugins/loc/lib/*`, `test/loc-cli.test.js`
- `image-compress` plugin: `plugins/image-compress/bin/image-compress.js`, `plugins/image-compress/lib/*`, `plugins/image-compress/backend/**`, `test/image-compress-plugin.test.js`
- `gstore` plugin: `plugins/gstore/bin/gstore.js`, `plugins/gstore/lib/*`, `test/gstore-cli.test.js`
- `pzip` plugin: `plugins/pzip/bin/pzip.js`, `plugins/pzip/lib/*`, `test/pzip-plugin.test.js`
- `slothvault` adapter: `plugins/slothvault/bin/*`, `plugins/slothvault/lib/component-service.js`, `plugins/slothvault/lib/manager-tui.js`, `test/slothvault-plugin.test.js`; Vault owns the runtime sources and tests.
- Offline install/bundle: `lib/commands/install.js`, `lib/commands/bundle.js`, `lib/services/plugin-service.js`, `test/offline-plugin-install.test.js`
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

`gstore` plugin:

```bash
node plugins/gstore/bin/gstore.js --help
node --check plugins/gstore/lib/service.js
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
node --test test/gstore-cli.test.js
```

`pzip` plugin:

```bash
node plugins/pzip/bin/pzip.js --help
node --check plugins/pzip/lib/service.js
SLOTHTOOL_PZIP_TUI_TEST_ACTION=exit node plugins/pzip/bin/pzip.js
node --test test/pzip-plugin.test.js
```

`slothvault` multifunction plugin:

```bash
node plugins/slothvault/bin/slothvault.js --help
node --check plugins/slothvault/lib/component-service.js
node --check plugins/slothvault/lib/deploy-runner.js
SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION=exit node plugins/slothvault/bin/slothvault.js
node --test test/slothvault-plugin.test.js test/slothvault-components.test.js test/slothvault-skill-manager.test.js test/slothvault-storage.test.js test/slothvault-manager-tui.test.js
npm run check:slothvault-helpers
```

Packaging:

```bash
npm pack --dry-run
cd plugins/loc && npm pack --dry-run
cd plugins/gstore && npm pack --dry-run
cd plugins/pzip && npm pack --dry-run
cd plugins/slothvault && npm pack --dry-run
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
- `plugins/gstore` shipped behavior changes require bumping `plugins/gstore/package.json` and its workspace lock entry.
- `plugins/pzip` shipped behavior changes require bumping `plugins/pzip/package.json` and its workspace lock entry.
- `plugins/slothvault` UI or adapter behavior changes require bumping `plugins/slothvault/package.json` and its workspace lock entry; Vault package content changes alone do not.
- If a change ships both core and the official plugin, bump both in the same change set.
- Before any commit that changes a shipped package version, confirm the intended version increment with the user. Do not choose the bump unilaterally.
- Before finishing shipped code changes, verify release tags are still free:
  - core: `slothtool-v<root-version>`
  - plugin: `plugin-loc-v<plugin-version>`
  - image-compress plugin: `plugin-image-compress-v<plugin-version>`
  - gstore plugin: `plugin-gstore-v<plugin-version>`
  - pzip plugin: `plugin-pzip-v<plugin-version>`
  - slothvault plugin: `plugin-slothvault-v<plugin-version>`
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
  - `plugins/gstore/bin/gstore.js`
  - `plugins/pzip/bin/pzip.js`
  - `plugins/slothvault/bin/slothvault.js`
  - `plugins/template-basic/bin/mytool.js`
