# @holic512/plugin-slothvault

SlothVault's SlothTool interface opens Overview and independently manages Deployment, Skill and MCP Client packages. Root `install`, `update` and bulk update checks manage only this UI plugin. SlothVault publishes the three external packages from its own repository under `deployment-v*`, `skill-v*` and `mcp-client-v*` Releases.

## Install the interface and the packages

```bash
slothtool install slothvault
slothtool sv
slothtool update slothvault --check
slothtool update slothvault

slothtool slothvault deploy package status
slothtool slothvault deploy package install
slothtool slothvault deploy package check
slothtool slothvault deploy package update
slothtool slothvault mcp package install
slothtool slothvault skill install
```

Online and offline UI installation download no external Vault packages. Each Tab shows its own missing/installed/damaged state and explicit install, check and update actions. Packages do not require another component or an MCP Profile. Explicit `slothtool update slothvault --module mcp-client|skill|deployment [--check]` remains available for compatibility.

MCP Client needs Python 3.10+ and its private virtual environment with hash-locked dependencies. Official PyPI is tried first; a connection failure allows the configured mirror or `SLOTHTOOL_PYPI_MIRROR` fallback. Deployment needs Python 3.10+ and the standard library. Missing or damaged deployment scripts, or unsupported Python, block application actions before launching the installer.

## TUI and progress

The four Tabs are Overview, Deploy, Skill and MCP. Overview reads only safe local summaries; missing or corrupt MCP Profiles cannot redirect the entry page. Actions stay on the left while state, Release notes, confirmation, input, progress and results remain on the right. Narrow terminals use a vertical layout. Press `v` for details, Up/Down or PageUp/PageDown to scroll, and Esc to return to actions. Results and errors remain until the next operation or explicit refresh.

Deployment distinguishes the **deployment package version** from the **deployed application version**. Updating the package changes the scripts; updating the application runs the managed installer. MCP separately shows its package, command registration, Profile configuration and connection status. Profile contents and servers are read only when entering Connection and profiles.

Downloads show measured bytes, total, percentage and speed. Validation, extraction, Python preparation, dependencies, activation and link checks show phase and elapsed time. An operation without a reliable total has no percentage. The current Vault Deployment bridge supplies phase events; optional measured image-layer/step progress fields are already supported. The other-repository implementation prompt is in [SLOTHVAULT_DEPLOYMENT_HANDOFF.md](../../SLOTHVAULT_DEPLOYMENT_HANDOFF.md).

Text, paths, versions and borders use the terminal foreground. Focus and selections use inverse text and bold; symbols and words carry status independently of color.

## Skill Release synchronization

```bash
slothtool slothvault skill status [--check] [--json]
slothtool slothvault skill install [--yes] [--json]
slothtool slothvault skill update [--json]
slothtool slothvault skill update --local
slothtool slothvault skill uninstall [--json]
```

Install and update both query the official Skill Release, download and validate it in temporary storage, then replace the single active `components/skill/current/` directory and verify agent links. A validated latest version repairs links without downloading again. Success removes archives, temporary content and verified old releases; failed activation restores previous content. A custom link still referencing a historical release protects that source during cleanup. `--local` is only a compatibility operation to repair installed links; the TUI uses Release synchronization.

Detected Codex uses `$CODEX_HOME/skills/slothvault-mcp` (default `~/.codex/skills/slothvault-mcp`); detected Claude Code uses `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp` (default `~/.claude/skills/slothvault-mcp`). New links are never created in `~/.agents/skills`. Custom content is preserved on updates and reported as a conflict. Replacing it during explicit installation requires confirmation; noninteractive replacement requires `--yes`.

## MCP connections and commands

```bash
slothtool slothvault mcp package status|install|check|update [--json]
slothtool slothvault setup --url https://vault.example --key-env SLOTHVAULT_KEY
slothtool slothvault mcp status
slothtool slothvault mcp register
slothtool slothvault mcp unregister
slothvault-mcp doctor --json
slothvault-mcp tools list --json
slothvault-mcp tools call TOOL_NAME --args-file ./args.json --yes --json
```

Connection setup manages connections and Profiles only. Skill installation and command registration are explicit operations. Registration uses the verified PATH-resolved installed `slothtool` command directory; direct source execution reports registration unavailable. Custom commands require explicit replacement (`--replace --yes` outside a terminal).

The embedded MCP TUI performs read-only discovery and local Profile management. Tool calls, Prompt retrieval and Resource reads belong to the separately registered `slothvault-mcp` command. Only `readOnlyHint: true` removes write confirmation. Keys enter through protected input, stdin or a named environment variable; stored Keys never enter TUI state and typed Keys are always masked. `--json` emits only a final JSON document, with no progress messages.

## Uninstall and clean old data

```bash
slothtool uninstall slothvault --keep-data
slothtool uninstall slothvault --purge-data --yes
slothtool --uninstall-all --keep-data --yes
slothtool --uninstall-all --purge-data --yes
slothtool slothvault cleanup --dry-run --json
slothtool slothvault cleanup --yes --json
```

Single CLI uninstall and TUI uninstall default to keeping configuration/history. Both policies remove the UI, all three runtime packages and verified managed links/launchers. Purge also removes fixed current/legacy plugin-owned config, history, data and cache paths. Bulk uninstall first handles external links and orphaned packages; legacy `--uninstall-all` without a policy still means complete purge. Purging data or batch uninstall needs a deletion preview and `--yes` outside an interactive terminal. Partial failures report completed and remaining paths for retry.

**Deployed applications, containers, databases, application data, Nginx configuration and certificates always remain.** Cleanup and uninstall do not require Python or runnable package contents.

Overview's Clean old data previews reclaimable size, obsolete versions, temporary remnants and Profile/history removal. It keeps active packages and valid links; migrates verified legacy Skill links before deleting their old sources; retains referenced or unverifiable directories. It clears both canonical and legacy MCP data so old Profiles cannot migrate back. Configure MCP again afterwards; the manager stays in Overview.

Profiles normally live at `~/.pipker/slothtool/plugin-configs/slothvault.json`, with redacted history under `~/.pipker/slothtool/data/slothvault/`. MCP Client and Deployment retain versioned releases with `current` pointers. Skill retains one active directory. Vault's cross-workspace contract is documented in `integrations/ARCHITECTURE.md`, `PROTOCOL.md` and `SYNC_UPDATES.md` in the SlothVault repository.

## 中文说明

默认进入总览，部署、Skill 和 MCP 各自安装、检查和更新自己的独立包。根管理器只管理界面；离线界面安装不触发外部包下载。左侧菜单持续保留，右侧展示可滚动的状态、Release 说明、真实进度、结果和错误。Skill 的安装与更新均同步正式 Release，成功后保留一份生效内容，自定义冲突保留。

卸载默认保留配置和历史，可显式清理插件拥有的数据；两种策略都删除运行包和受管链接，保留已部署应用。总览“清理旧数据”先预览范围和大小，确认后删除安全的旧包／残留，清空当前及旧 MCP 配置和历史，之后需要重新配置连接。当前 Deployment 脚本只上报阶段；真实镜像层下载进度需要另一仓库按对接提示词增强。
