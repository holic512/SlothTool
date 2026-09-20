# @holic512/plugin-slothvault-mcp

SlothVault administrator MCP client for SlothTool. The plugin discovers tools, prompts, and resource templates from the server at runtime; it does not embed a fixed SlothVault tool catalog.

The CLI is the only remote MCP execution surface. The full-screen TUI displays connection state, live capabilities, and redacted local call history, and it can manage local connection profiles and the bundled agent Skill. It never calls Tools, fetches Prompt content, or reads Resources.

## Requirements

- Node.js 22 or newer
- A SlothVault administrator MCP endpoint
- A SlothVault MCP key with the `svmcp_` format

Keys are stored as plain text in the plugin profile file. SlothTool's `gstore` plugin may synchronize `plugin-configs`, so treat its private repository as credential-bearing data. Prefer HTTPS; HTTP is allowed for controlled intranet deployments but sends the Bearer key in clear text.

## Profiles

```bash
# Hidden interactive key input
slothvault-mcp profile add production --url https://vault.example.com/mcp --default

# Scripted input without exposing the key in process arguments
printf '%s\n' "$SLOTHVAULT_MCP_KEY" | slothvault-mcp profile add production \
  --url https://vault.example.com/mcp --key-stdin --default

slothvault-mcp profile add staging --url http://vault.internal/mcp \
  --key-env SLOTHVAULT_STAGING_KEY --timeout 30000
slothvault-mcp profile list
slothvault-mcp profile show production
slothvault-mcp profile use staging
slothvault-mcp profile update staging --timeout 60000
slothvault-mcp profile remove staging
```

Profiles are stored in `~/.pipker/slothtool/plugin-configs/slothvault-mcp.json`. Profile output masks the stored key.

## Discovery and calls

```bash
slothvault-mcp doctor --json
slothvault-mcp tools list
slothvault-mcp tools show content.note.content.list_versions
slothvault-mcp tools call content.note.content.list_versions --args '{"noteId":"..."}'

slothvault-mcp prompts list
slothvault-mcp prompts get content-review --args-file ./prompt-args.json
slothvault-mcp resources list
slothvault-mcp resources read 'slothvault://managed-file/...' --output ./artifact.bin
```

`--args` and `--args-file` accept a JSON object and are mutually exclusive. `--args-file -` reads JSON from stdin. Tools are classified from live MCP annotations: only `readOnlyHint: true` executes without confirmation. All other tools require interactive confirmation or explicit `--yes`; non-TTY and `--json` calls always require `--yes` for write-capable tools.

Tool calls are not automatically retried. Resource downloads validate the SlothVault URI family, MIME type, Base64 payload, size limit, and the server-provided `_meta["slothvault/file-name"]`, then write a new output file without replacing an existing path. The client retains a legacy fallback for the former top-level `name` field.

## Agent Skill

The release includes a `slothvault-mcp` Skill that directs supported coding agents to use this CLI, inspect the live MCP catalog, protect credentials, and confirm every Tool that is not explicitly annotated as read-only.

```bash
slothvault-mcp skill status
slothvault-mcp skill install
slothvault-mcp skill uninstall
```

Installation first detects Codex and Claude Code from their configuration directories or executables, then creates a directory link for every detected agent: `$CODEX_HOME/skills/slothvault-mcp` (default `~/.codex/skills/slothvault-mcp`) and `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp` (default `~/.claude/skills/slothvault-mcp`). It does not create new links under `~/.agents/skills`. This keeps the Skill synchronized when SlothTool updates the plugin in place. On Windows, the equivalent directory junction is used. Restart an agent if the Skill does not appear.

If another file, directory, or link already occupies any detected-agent target, interactive installation lists every conflicting path before asking whether to permanently delete them without a backup. Non-interactive and `--json` replacement require `--yes`. Uninstall removes only links that point to this plugin's current Skill and refuses to delete unmanaged targets. A managed link left by version 1.2.0 under `~/.agents/skills` is removed during the next install or uninstall; conflicting content there is never deleted.

Run `slothvault-mcp skill uninstall` before uninstalling the SlothTool plugin. `slothtool uninstall slothvault-mcp` does not remove the user-level Skill link automatically.

## History and TUI

```bash
slothvault-mcp history list
slothvault-mcp history show <id>
slothvault-mcp history clear --yes
slothvault-mcp
```

History is stored in `~/.pipker/slothtool/data/slothvault-mcp/history.json`, capped at 200 redacted summaries. Full arguments, full results, Bearer keys, and resource payloads are never retained. Uninstalling the plugin keeps this history until it is explicitly cleared.

In the TUI, use `Tab` to switch among Status, Capabilities, History, Profiles, and Skill; use the arrow keys to inspect items, `r` to refresh the active remote page or the local Skill status, and `q` to exit. On the Profiles page, use `a` to add, `e` or `Enter` to edit, `u` to select the default, and `d` to delete after confirmation. Profile forms use `Up`/`Down` to move between fields, `Enter` to advance or save, `Ctrl+U` to clear the current field, `Space` to toggle the default setting, and `Esc` to cancel. On the Skill page, use `i` or `Enter` to install and `u` to uninstall; replacement and uninstall require `y/n` confirmation.

The TUI never loads an existing raw key into an edit form and never renders a newly typed key. Leaving the key field empty while editing preserves the stored value. Profile changes are local and do not connect automatically; press `r` after changing the default profile or its connection settings to refresh remote capabilities. The TUI still never calls Tools, fetches Prompt content, reads Resources, or clears history.

## JSON and exit codes

With `--json`, stdout contains one JSON document and warnings are written to stderr.

| Code | Meaning |
| ---: | --- |
| 0 | Success |
| 1 | Unexpected internal or filesystem error |
| 2 | Usage, configuration, or confirmation error |
| 3 | Authentication failure |
| 4 | Network, timeout, unavailable server, or MCP protocol failure |
| 5 | MCP tool business error (`isError: true`) |
