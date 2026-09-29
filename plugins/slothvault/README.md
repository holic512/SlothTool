# @holic512/plugin-slothvault

This package provides SlothTool's SlothVault command entry and full-screen manager. The MCP client, coding-agent Skill, and Python deployment program are maintained in the SlothVault repository and published together as a `toolkit-vX.Y.Z` Release. SlothTool installs that runtime under `~/.pipker/slothtool/runtimes/slothvault/` and communicates with it through a versioned JSON command interface and JSON-line deployment events.

## Install and update

```bash
slothtool install slothvault
slothtool update slothvault --check
slothtool update slothvault
slothtool slothvault
```

The online install obtains both the SlothTool interface Release and the Vault toolkit Release. The update check reports their versions separately. MCP client and Skill files always come from the same toolkit package. An update downloads and verifies the complete package before switching the active runtime; a failed runtime switch keeps the previous runtime active. Custom Skill targets are reported as conflicts and are not replaced by automatic updates.

`slothtool bundle slothvault` contains only this interface. `slothtool install slothvault --file <bundle.tgz>` uses the local interface archive and then downloads the Vault toolkit, so it requires network access. The toolkit is managed by SlothTool and has no separate installer.

## Command entry points

`slothtool slothvault` opens the local manager TUI. It provides connection setup, local Profile management, remote read-only discovery, Skill and MCP command registration, and deployment. Opening the manager does not start deployment or invoke a remote MCP Tool.

```bash
slothtool slothvault setup
slothtool slothvault skill status
slothtool slothvault skill install
slothtool slothvault skill update
slothtool slothvault mcp register
slothtool slothvault deploy --action check-update
```

The old `slothtool slothvault skill update` command calls the unified SlothTool update flow. `--local` only resynchronizes managed Skill links from the installed toolkit. `slothtool slothvault-mcp` remains a compatibility alias for the standalone MCP command.

`slothvault-mcp` with no arguments shows help. It is the entry for administrator MCP operations, including Profiles, live Tool/Prompt/Resource discovery, guarded Tool calls, Resource downloads, storage status, and redacted history. Register it with `slothtool slothvault mcp register` after installing SlothTool as a command on `PATH`.

```bash
slothvault-mcp setup
slothvault-mcp profile list
slothvault-mcp doctor --json
slothvault-mcp tools list
slothvault-mcp tools call <tool-name> --args-file ./args.json --yes
```

Only a Tool explicitly annotated `readOnlyHint: true` runs without write confirmation. Other Tools require interactive confirmation or `--yes`. A Key is accepted through a hidden prompt, standard input, or a named environment variable; avoid placing it in command arguments. Profile output masks stored Keys.

## Data and links

Profiles remain in `~/.pipker/slothtool/plugin-configs/slothvault.json`; redacted call history remains in `~/.pipker/slothtool/data/slothvault/`. Existing data is reused, with the legacy `slothvault-mcp` locations migrated only when the canonical location is absent. Uninstalling the plugin retains Profile/Key and history data.

The toolkit manages detected Codex and Claude Code Skill links at `$CODEX_HOME/skills/slothvault-mcp` and `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp` (defaulting to the matching directories under `~`). Only links verified as managed by the current or legacy package are redirected or removed automatically. Other files and link targets remain in place and are reported as conflicts. Uninstall removes the toolkit and verified managed links.

Deployment remains available through the manager or `slothtool slothvault deploy`. The Vault toolkit supplies the Python 3.8+ implementation. Docker Engine and Docker Compose v2 are required for deployment; actions that modify system Nginx, Certbot, or `/data` require suitable host privileges. To preserve the installing user's SlothTool data when elevating, use:

```bash
sudo env HOME="$HOME" "$(command -v slothtool)" slothvault deploy
```
