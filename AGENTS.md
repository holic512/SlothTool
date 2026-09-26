# AGENTS.md

Concise repo rules for Codex working on SlothTool.

## 1. Project Facts

- SlothTool is a TUI-first plugin manager.
- Root package: `@holic512/slothtool`
- The current built-in official plugin catalog exposed by the root manager contains `@holic512/plugin-loc`, `@holic512/plugin-image-compress`, `@holic512/plugin-gstore`, `@holic512/plugin-codex-models`, `@holic512/plugin-pzip`, and `@holic512/plugin-slothvault`.
- `plugins/image-compress` ships as an official plugin workspace with a dedicated multi-platform release workflow and target-aware asset installation.
- `plugins/gstore` ships as an official CLI + TUI plugin workspace for syncing SlothTool settings, plugin configs, and data through an isolated Git repository cache and a GitHub private repository via local `git` and `gh`.
- Root and official plugin TUIs share the scaffold/loc shell: high-contrast tabs, divider, responsive rounded panels, and a bottom status/keymap bar.
- `plugins/codex-models` ships as an official CLI + TUI plugin workspace for Codex custom-provider diagnostics, cross-vendor model metadata, reasoning-level switching, catalog sync, and safe Desktop offline repair-script generation.
- `plugins/pzip` ships as an official CLI + TUI plugin workspace for recursive ZIP packaging with configurable macOS/build/Git metadata filtering and nested `.gitignore` support.
- `plugins/slothvault` ships as the official SlothVault multifunction workspace: `slothtool slothvault` manages Linux deployment, user-installable Codex/Claude Code Skill links, and explicit standalone MCP command registration; the independently registered `slothvault-mcp` executable dynamically discovers and safely invokes the administrator MCP while its TUI manages only local profiles and read-only remote inspection.
- Root alias migration moves only the SlothVault plugin identity, registry entry, and installed directory; Profile and redacted-history path migration belongs exclusively to a current SlothVault multifunction plugin.
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
- The SlothVault manager TUI shows structured state for the selected managed deployment and handles deployment prompts, progress, and results inside Ink; its CLI and TUI reuse the bundled Python deployment service.
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
- A self-contained archive must include production `node_modules`; otherwise installation may only use `npm install --omit=dev --offline` and must never silently fetch from the network.
- `bundle <alias>` must refuse to create an incomplete dependency-bearing archive.
- Offline installations record `sourceType: "offline-archive"` in the registry.

Cross-platform official plugin rules:

- If a plugin needs target-specific release assets, declare `assetStrategy: "platform-target"` in `lib/official-plugins.json`.
- Declare explicit `supportedTargets` in `lib/official-plugins.json` using normalized targets such as `macos-arm64`, `macos-amd64`, `linux-amd64`, `linux-arm64`, `windows-amd64`.
- Release asset names must follow `<assetNamePrefix><version>-<target>.tgz`.
- Release archives must contain a runnable plugin root either directly at archive root or under the standard `package/` directory produced by `npm pack`.
- If the plugin ships a prebuilt backend, place it under `backend/dist/`, and keep the Node wrapper able to prefer that binary at runtime.

SlothVault multifunction package rules:

- Discover Tools, Prompts, and Resource Templates from the live MCP server; do not hardcode the SlothVault business catalog.
- Only `annotations.readOnlyHint === true` is read-only. Missing or false annotations require write confirmation, and non-interactive calls require `--yes`.
- Keep remote business operations read-only in the TUI. Local Profile add/update/default/remove operations are allowed, while Tool calls, Prompt retrieval, and Resource reads belong to the CLI.
- Keep the bundled Skill under `plugins/slothvault/skills/slothvault-mcp`; install it only through an explicit `slothtool slothvault skill …` action for detected Codex or Claude Code environments in their agent-specific user Skill directories.
- Detect Codex through its config directory or `codex` executable and target `$CODEX_HOME/skills` (default `~/.codex/skills`); detect Claude Code through its config directory or `claude` executable and target `$CLAUDE_CONFIG_DIR/skills` (default `~/.claude/skills`). Do not create new links under `~/.agents/skills`.
- Skill conflict replacement requires explicit confirmation and may delete only fixed detected-agent Skill targets. Skill uninstall may remove only links that resolve to the current bundled Skill.
- Never load a stored raw MCP Key into TUI state or render typed Key content; clear transient Key input after save, cancellation, or validation failure.
- Never print or persist complete credentials, request arguments, results, or Resource payloads outside their explicit output file.
- Register `slothvault-mcp` only beside the verified, PATH-resolved running `slothtool` command. Direct source execution must report that registration is unavailable; Unix/macOS launchers are managed links, Windows launchers are marked `.cmd` shims, and non-managed targets are never replaced or deleted without the explicit registration flow.
- Do not forward MCP operations from `slothtool slothvault`; reject them with the standalone-command guidance. Before launching SlothVault, reject any installed package that is not the current dual-executable `@holic512/plugin-slothvault` runtime so it cannot recreate the legacy configuration path.

## 5. Fast Change Map

- Root command dispatch/help: `bin/slothtool.js`, `lib/commands/*`, `test/root-cli.test.js`
- Root services/persistence: `lib/services/plugin-service.js`, `lib/registry.js`, `lib/settings.js`
- Root TUI/i18n: `lib/tui/root-tui.js`, `lib/i18n.js`
- Official plugin catalog: `lib/official-plugins.json`
- `loc` plugin: `plugins/loc/bin/loc.js`, `plugins/loc/lib/*`, `test/loc-cli.test.js`
- `image-compress` plugin: `plugins/image-compress/bin/image-compress.js`, `plugins/image-compress/lib/*`, `plugins/image-compress/backend/**`, `test/image-compress-plugin.test.js`
- `gstore` plugin: `plugins/gstore/bin/gstore.js`, `plugins/gstore/lib/*`, `test/gstore-cli.test.js`
- `codex-models` plugin: `plugins/codex-models/bin/codex-models.js`, `plugins/codex-models/lib/*`, `test/codex-models-cli.test.js`
- `pzip` plugin: `plugins/pzip/bin/pzip.js`, `plugins/pzip/lib/*`, `test/pzip-plugin.test.js`
- `slothvault` plugin: `plugins/slothvault/bin/slothvault.js`, `plugins/slothvault/bin/slothvault-mcp.js`, `plugins/slothvault/deploy/*`, `plugins/slothvault/lib/*`, `plugins/slothvault/skills/slothvault-mcp/*`, `test/slothvault-plugin.test.js`
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

`codex-models` plugin:

```bash
node plugins/codex-models/bin/codex-models.js --help
node --check plugins/codex-models/lib/model-library.js
node --check plugins/codex-models/lib/service.js
SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION=exit node plugins/codex-models/bin/codex-models.js
node --test test/codex-models-cli.test.js
node --test test/offline-plugin-install.test.js
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
node plugins/slothvault/bin/slothvault-mcp.js --help
node --check plugins/slothvault/lib/deploy-runner.js
node --check plugins/slothvault/lib/mcp-command-manager.js
node --check plugins/slothvault/lib/service.js
node --check plugins/slothvault/lib/skill-manager.js
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/slothvault/skills/slothvault-mcp
PYTHONDONTWRITEBYTECODE=1 python3 plugins/slothvault/deploy/tests/deploy_installer_test.py
SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION=exit node plugins/slothvault/bin/slothvault.js
SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION=exit node plugins/slothvault/bin/slothvault-mcp.js
node --test test/slothvault-plugin.test.js
```

Packaging:

```bash
npm pack --dry-run
cd plugins/loc && npm pack --dry-run
cd plugins/gstore && npm pack --dry-run
cd plugins/codex-models && npm pack --dry-run
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
- `plugins/codex-models` shipped behavior changes require bumping `plugins/codex-models/package.json` and its workspace lock entry.
- `plugins/pzip` shipped behavior changes require bumping `plugins/pzip/package.json` and its workspace lock entry.
- `plugins/slothvault` shipped behavior changes require bumping `plugins/slothvault/package.json` and its workspace lock entry.
- If a change ships both core and the official plugin, bump both in the same change set.
- Before any commit that changes a shipped package version, confirm the intended version increment with the user. Do not choose the bump unilaterally.
- Before finishing shipped code changes, verify release tags are still free:
  - core: `slothtool-v<root-version>`
  - plugin: `plugin-loc-v<plugin-version>`
  - image-compress plugin: `plugin-image-compress-v<plugin-version>`
  - gstore plugin: `plugin-gstore-v<plugin-version>`
  - codex-models plugin: `plugin-codex-models-v<plugin-version>`
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
  - `plugins/codex-models/bin/codex-models.js`
  - `plugins/pzip/bin/pzip.js`
  - `plugins/slothvault/bin/slothvault.js`
  - `plugins/slothvault/bin/slothvault-mcp.js`
  - `plugins/template-basic/bin/mytool.js`
