# SlothVault：管理插件与 Skill 包

本 Skill 的范围是本地 SlothTool 管理层，不处理 Vault 的文章、文件、发布等业务。不实现 MCP Client/runtime，不安装 venv/pip，不创建 Profile，不读取或写入 Token、密码或原生 agent MCP 配置。用户需要业务操作时，使用其独立授权的原生 MCP 与 Vault 自带 Skill；这里不复制该 Skill 内容，也不自动配置连接。

## 插件与 Skill

`slothtool install slothvault` / `slothtool update slothvault` 管理插件 UI；Skill 内容通过其独立正式 Release 显式同步，插件只管理检测到的 Codex / Claude Code 链接。

只读检查：

```sh
slothtool slothvault --help
slothtool slothvault skill status --json
slothtool slothvault skill status --check --json
slothtool slothvault cleanup --dry-run --json
```

`skill update --check` 仍会走更新分支；检查版本必须使用 **`skill status --check`**。

经具体授权执行：

```sh
slothtool slothvault skill install --json
slothtool slothvault skill update --json
slothtool slothvault skill update --local --json
slothtool slothvault skill uninstall --json
```

这些操作会下载 Skill 或改变本地内容和链接，不能因为自动安装插件而自动执行。冲突替换须明确授权后才使用 `skill install --yes --json`。自动更新保留自定义目标；离线修复仅使用现有内容。遵循 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`，不另建 `~/.agents/skills` 链接。

部署能力已从 SlothTool 移除，不再安装、检查或更新 Deployment 包。部署需求交给 SlothVault 独立 Deployment Release 的 `menu.py` 和各操作脚本，并依据其随包说明及用户对目标环境的授权执行。

## 清理边界

先运行上面的 `cleanup --dry-run --json`，检查列出的受管目标；取得明确删除授权后才运行：

```sh
slothtool slothvault cleanup --yes --json
```

预览不是执行；`--yes` 不是授权本身。只清理插件定义的旧数据与经验证的退役内容，不扩大到原生 agent MCP 配置、活动/自定义引用来源或已部署应用。根插件卸载也始终保留部署出的容器、数据库、Nginx 和证书。

已退役的 `mcp`、`setup`、`profile`、`doctor`、`tools` 等不是本插件可用的业务/MCP 功能；不要靠旧别名启动脚本、恢复历史 Profile 或获取凭据。

源码核对位置：`plugins/slothvault/bin/slothvault.js`、`plugins/slothvault/lib/skill-service.js`、`lib/commands/update.js`。
