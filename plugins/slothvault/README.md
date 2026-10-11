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

The three Tabs are Overview, Deploy and Skill. Overview reads local state without connecting to MCP. Deploy highlights the actual running application version; script-package status/install/check/update live in the “Manage deployment package” subpage. UI **3.1.0**, Deployment **1.1.0**, Skill and application versions remain independent.

“Update application” checks the running container and official Release, then shows one fixed target, image, directory and restart impact before one backend confirmation. Enhanced prompts use `y` to continue and `n`/Esc to cancel; legacy Deployment prompts require typing `y` and pressing Enter. Release history is collapsed by default; `d` expands it.

The right panel pins state, actual → target version, phase and execution/input-wait clocks above scrollable logs. Waiting pauses execution timing. Cyan labels, yellow waiting, green success and red failure accompany text and symbols. Logs follow new output until manual scrolling. Press `v` to focus, Up/Down or PageUp/PageDown to scroll, `f`/End to resume following, and Esc to return. Narrow terminals use a vertical layout. After 30 seconds without business progress, the panel reports the current phase and silence duration; a process heartbeat is separate from download progress.

Deployment pulls the confirmed image through a private temporary Compose configuration, activates the real configuration only after pull, recreates the application and verifies its running image, embedded release identity and health locally. It waits up to 120 seconds for health and clearly reports absent health checks. A successful process exit alone cannot report application update success. Failure before recreation restores configuration; failure after recreation reports actual state without automatic rollback of possibly migrated data. JSON Compose layer measurements fall back to plain progress or phase-only events. Percentages describe an individual measured layer, never the overall update. Final snapshots refresh runtime versions even after cancellation/failure; `r` refreshes on demand. See [the bridge contract](../../SLOTHVAULT_DEPLOYMENT_HANDOFF.md).

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

Skill 仍从 Vault 仓库正式 Release 同步；当前发布内容如果包含旧 CLI 指引，需要另一仓库更新。总览、部署与 Skill 三页保留右侧固定状态、滚动进度、结果与错误。部署脚本包管理位于子页；更新应用自动检查目标并只确认一次，等待输入单独计时。`d` 展开说明，`v` 滚动日志，`f`／End 恢复跟随；实际版本核验失败时不会报告成功。旧数据清理和卸载不会改动智能体原生 MCP 配置或已部署应用。
