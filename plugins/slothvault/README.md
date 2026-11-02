# @holic512/plugin-slothvault

SlothTool 的 SlothVault 插件只管理官方 Skill 内容及 Codex / Claude Code 的受管链接。默认进入单页 Skill 管理界面；部署工具在 SlothVault 仓库独立维护和发布。

## 安装与使用

```bash
slothtool install slothvault
slothtool sv
slothtool update slothvault --check
slothtool slothvault skill status --json
slothtool slothvault skill status --check --json
slothtool slothvault skill install
slothtool slothvault skill update
slothtool slothvault skill update --local
slothtool slothvault skill uninstall
slothtool update slothvault --module skill --check --json
```

根安装和更新只管理插件界面；Skill 安装与更新显式获取 Vault 的 `skill-v*` 正式 Release，验证归档与逐文件 SHA-256 后激活唯一 `components/skill/current/` 目录。安装失败恢复旧内容，当前内容有效时可直接修复链接。`--local` 只离线修复现有内容的链接。

Codex 目标为 `$CODEX_HOME/skills/slothvault-mcp`，Claude Code 目标为 `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp`；未设置时使用默认配置目录，只针对检测到的智能体。自动更新保留自定义目标，安装替换冲突需明确确认；非交互调用仅在已授权替换时使用 `skill install --yes`。

## 界面

操作包括状态、安装／修复、检查更新、更新、离线修复链接与卸载。`c` 检查、`n` 更新、`i` 安装、`l` 离线修复、`u` 卸载、`r` 刷新、`q` 退出。`v` 聚焦右侧详情，↑↓／PageUp／PageDown 滚动，`f`／End 跟随最新输出，Esc 返回操作；`d` 展开更新说明。操作过程中菜单保留，完成后的结果与错误可继续查看。窄终端采用上下布局。

## 独立部署与旧入口

SlothTool 不再安装、更新或执行 Deployment 包。旧 `deploy`、`deploy package ...` 和根 `--module deployment` 返回 `SLOTHVAULT_DEPLOYMENT_REMOVED`。下载 SlothVault 独立 Deployment Release，核验并解压后执行 `python3 menu.py`，或直接执行 `install.py`、`check_update.py`、`update.py`、`start.py`、`stop.py`、`restart.py`、`status.py`。完整迁移说明见 [部署交接说明](../../SLOTHVAULT_DEPLOYMENT_HANDOFF.md)。

## 清理与卸载

```bash
slothtool slothvault cleanup --dry-run --json
slothtool slothvault cleanup --yes --json
slothtool uninstall slothvault --keep-data
slothtool uninstall slothvault --purge-data --yes
```

普通升级保留历史部署包。清理仅处理经验证的退役部署脚本包、旧 Client／Profile／历史、受管旧命令和暂存残留；保留活动 Skill 及自定义引用来源。插件卸载先移除受管链接再移除包，默认保留配置历史，显式 purge 才清理插件拥有的数据。这些操作不需要 Python，也不会修改已部署应用、数据库、Nginx、证书或智能体原生 MCP 配置。

## Native MCP / English

This plugin manages only SlothVault Skills and detected Codex / Claude Code links. Root install/update manages the UI; explicit Skill commands synchronize the official Skill Release. The default TUI is a single Skill page with persistent actions and scrollable progress/results. Custom targets are preserved during automatic updates; explicit installation replacement requires confirmation.

Deployment now runs independently: extract the standalone Vault Deployment Release and run `python3 menu.py` or an individual operation script. SlothTool deployment commands return migration guidance without starting Python or downloading deployment payloads. Cleanup and uninstall preserve deployed applications, databases, proxy/certificate configuration and native agent MCP settings.

Agents connect directly to the SlothVault `/mcp` endpoint through their native MCP configuration. SlothTool does not store keys, create Profiles or implement an MCP Client. Retired `mcp`, `setup`, `profile`, `doctor` and business commands return native connection guidance. See [the native MCP handoff](../../SLOTHVAULT_NATIVE_MCP_HANDOFF.md).
