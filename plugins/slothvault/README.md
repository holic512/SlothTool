# @holic512/plugin-slothvault

This SlothTool plugin provides installation, updates, TUI pages, Skill links, and standalone MCP command registration. SlothVault independently releases the MCP Client, Skill, and Deployment packages. Their cross-workspace protocol is documented in SlothVault's `integrations/ARCHITECTURE.md`, `PROTOCOL.md`, and `SYNC_UPDATES.md`.

## Install and update

```bash
slothtool install slothvault
slothtool sv
slothtool update slothvault --check
slothtool update slothvault
slothtool update slothvault --module mcp-client --check
slothtool update slothvault --module mcp-client
slothtool update slothvault --module skill
slothtool update slothvault --module deployment
```

Installation stages and validates all three Vault packages before switching active pointers. Failed component updates keep the previous pointer. Installed versions live at `~/.pipker/slothtool/runtimes/slothvault/components/<module>/releases/<version>`; the old `toolkit-v` directory remains available for migration fallback. A SlothVault offline UI bundle still requires network access to obtain the three Vault packages.

The MCP Client requires Python 3.10+ and a private virtual environment with hash-locked dependencies. SlothTool uses official PyPI first and switches to `SLOTHTOOL_PYPI_MIRROR` or the default fallback only after connection failures. The Deployment Package requires Python 3.10+ and uses the standard library.

## Commands and pages

`slothtool sv` and `slothtool slothvault` open the same management TUI. `sv` is a non-deprecated alias for one registry entry. The MCP, Skill, and Deployment pages show installed and latest package versions, check status, and update results. Deployment also shows the deployed app version. Incompatible MCP Client versions or protocols block remote operations and expose an update action; an update that remains incompatible does not bypass the block.

```bash
slothtool sv setup
slothtool sv skill status
slothtool sv skill install
slothtool sv skill update
slothtool sv mcp register
slothtool sv deploy --action check-update
slothvault-mcp doctor --json
slothvault-mcp tools list --json
slothvault-mcp tools call <tool-name> --args-file ./args.json --yes --json
```

The MCP TUI performs read-only discovery and local Profile management. Tool calls, Prompt retrieval, and Resource reads belong to the `slothvault-mcp` CLI. Only `readOnlyHint: true` removes the write confirmation requirement. Keys are passed through hidden input, stdin, or a named environment variable, never through command arguments or TUI state.

## Data and migration

Profiles remain at `~/.pipker/slothtool/plugin-configs/slothvault.json`; redacted history remains under `~/.pipker/slothtool/data/slothvault/`. Legacy `slothvault-mcp` data moves only if the canonical path is absent. SlothTool redirects only verified managed Codex or Claude Skill links; custom Skill targets are preserved and shown as conflicts. Users can also copy the Vault Skill package manually.

Deployment is available through `slothtool sv deploy` or the TUI. Docker Engine and Docker Compose v2 must be installed separately. Host Nginx, Certbot, and `/data` operations require suitable privileges. To preserve the installing user's SlothTool data when elevating:

```bash
sudo env HOME="$HOME" "$(command -v slothtool)" sv deploy
```
