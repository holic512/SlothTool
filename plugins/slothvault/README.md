# @holic512/plugin-slothvault

SlothTool's SlothVault plugin manages independent Deployment and Skill packages. Agents such as Codex connect directly to the SlothVault MCP server through their native settings. The plugin has one executable, `slothvault`, and no MCP Client, Profile editor or standalone MCP launcher.

## Install and manage packages

```bash
slothtool install slothvault
slothtool sv
slothtool update slothvault --check
slothtool slothvault deploy package status|install|check|update [--json]
slothtool slothvault skill status [--check] [--json]
slothtool slothvault skill install [--yes] [--json]
slothtool slothvault skill update [--json]
slothtool slothvault skill update --local
slothtool slothvault skill uninstall [--json]
```

Root installation and updates manage only the UI; online and offline UI installation download no external packages. Explicit `slothtool update slothvault --module skill|deployment [--check] [--json]` remains available. Each package resolves its own official `skill-v*` or `deployment-v*` Release. Only deployment execution needs Python 3.10+; no Python virtual environment or pip dependencies are prepared.

## Native MCP connections

Configure the SlothVault server in your agent. For Codex:

```toml
[mcp_servers.slothvault]
url = "https://vault.example.com/mcp"
http_headers = { Authorization = "Bearer <SlothVault MCP Key>" }
default_tools_approval_mode = "auto"
tool_timeout_sec = 120
```

Replace the URL and placeholder with your server and its MCP key. The agent owns transport, discovery, calls and approval policy. SlothTool does not store these credentials or edit native agent configuration. Retired `mcp`, `setup`, `profile`, `doctor` and business CLI commands return `SLOTHVAULT_MCP_CLIENT_REMOVED` with native configuration guidance. The deprecated root plugin alias routes to the primary manager.

Vault owns the Skill's instructions. Its existing released Skill may still direct agents to the retired CLI and needs an independent update to use native MCP tools. The repository handoff document [SLOTHVAULT_NATIVE_MCP_HANDOFF.md](../../SLOTHVAULT_NATIVE_MCP_HANDOFF.md) includes Client removal, Skill migration and a one-time configuration dialog for the Vault website.

## TUI and measured progress

The three Tabs are Overview, Deploy and Skill. Local Overview never reads MCP Profiles or connects to servers. The left menu stays visible while the right panel retains scrollable state, Release notes, confirmation, input, progress and results. Narrow terminals use a vertical layout. Press `v` to focus details, Up/Down or PageUp/PageDown to scroll, and Esc to return. Foreground text and borders use terminal defaults; selections use inverse text and bold.

Deployment distinguishes script-package updates from application updates. Missing/damaged scripts or unsupported Python block application operations. Downloads display measured bytes, totals and speed; operations without a reliable total show phase and elapsed time without a fabricated percentage. Optional enhanced Deployment bridge progress remains supported; see [the Deployment handoff](../../SLOTHVAULT_DEPLOYMENT_HANDOFF.md).

Skill install/update downloads and verifies the official Release in temporary storage, activates one stable `components/skill/current/` directory and verifies agent links. Valid latest content repairs links without another download; activation failures restore the old content. `--local` repairs links only. Codex targets `$CODEX_HOME/skills/slothvault-mcp` and Claude Code targets `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp`, using their default config directories when unset. The Skill directory name remains unchanged. Automatic updates preserve custom content; explicit replacement requires confirmation.

## Cleanup and uninstall

```bash
slothtool slothvault cleanup --dry-run --json
slothtool slothvault cleanup --yes --json
slothtool uninstall slothvault --keep-data
slothtool uninstall slothvault --purge-data --yes
```

Cleanup previews and removes verified legacy Client payloads, commands, Profiles/history and obsolete package residue. It retains active Deployment/Skill content and referenced or unverifiable sources. Uninstall removes the interface, runtimes and managed links, keeping plugin data by default; purge removes fixed plugin-owned data paths too. Both operations work without Python. Native agent MCP configuration, custom targets, other plugins and deployed applications/databases/Nginx/certificates are protected.

## 中文说明

插件只管理部署与 Skill，默认进入总览。独立 MCP Client、Profile 表单、第二个命令与连接检查页面已移除；Codex 等智能体通过自己的原生 MCP 配置直连 SlothVault。旧 Client 运行包和受管命令仅保留清理兼容，不再安装或执行。

Skill 仍从 Vault 仓库正式 Release 同步；当前发布内容如果包含旧 CLI 指引，需要另一仓库更新。总览、部署与 Skill 三页保留右侧状态、进度、结果与错误。旧数据清理和卸载不会改动智能体原生 MCP 配置或已部署应用。
