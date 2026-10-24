# SlothVault：仅管理插件、Deployment 包与 Skill 包

本 Skill 的范围是本地 SlothTool 管理层，不处理 Vault 的文章、文件、发布等业务。不实现 MCP Client/runtime，不安装 venv/pip，不创建 Profile，不读取或写入 Token、密码或原生 agent MCP 配置。用户需要业务操作时，使用其独立授权的原生 MCP 与 Vault 自带 Skill；这里不复制该 Skill 内容，也不自动配置连接。

## 三个独立对象

1. `slothtool install slothvault` / `slothtool update slothvault` 管理插件 UI，不自动下载下面两个包，更不等于部署应用。
2. Deployment 包拥有实际部署程序，通过其包管理命令独立安装/更新。
3. Vault Skill 包拥有 `slothvault-mcp` 的内容；本插件仅管理受检测 agent 的链接。

先查看本地状态或显式联网检查：

```sh
slothtool slothvault --help
slothtool slothvault deploy package status --json
slothtool slothvault deploy package check --json
slothtool slothvault skill status --json
slothtool slothvault skill status --check --json
slothtool slothvault cleanup --dry-run --json
```

`--check` 不是所有动作的统一预览：例如 `skill update --check` 仍会走更新分支；检查 Skill 必须用 **`skill status --check`**。`deploy --help` 被包装器拦截为插件帮助，不等于当前 Deployment 包的完整参数说明。

## 经具体授权才执行

```sh
slothtool slothvault deploy package install --json
slothtool slothvault deploy package update --json
slothtool slothvault skill install --json
slothtool slothvault skill update --json
slothtool slothvault skill uninstall --json
```

这些操作会下载包或改变本地安装/链接，不能因插件缺失的自动安装规则而自动执行。Skill 安装冲突时停止，告知固定 agent 目标及现有内容；用户明确允许替换后才能 `skill install --yes --json`。更新应保留自定义目标，不自行删除来源或链接。只面向检测到的 Codex/Claude Code，遵循 `CODEX_HOME`、`CLAUDE_CONFIG_DIR`，不另建 `~/.agents/skills` 链接。

部署执行通过 `slothtool slothvault deploy` 转发给已安装的独立包；**不要裸调用**，避免其默认交互流程。具体 action/参数必须依据该已安装包的能力与对应官方说明，不能从插件版本推断。部署、升级、Nginx、容器、数据库、证书等外部操作，先确认目标环境、影响和授权；缺包、Python 或运行权限时停止报告，不自动补装运行环境或部署。此参考不承载部署业务实现。

## 清理边界

先运行上面的 `cleanup --dry-run --json`，检查列出的受管目标；取得明确删除授权后才运行：

```sh
slothtool slothvault cleanup --yes --json
```

预览不是执行；`--yes` 不是授权本身。只清理插件定义的旧数据与经验证的退役内容，不扩大到原生 agent MCP 配置、活动/自定义引用来源或已部署应用。根插件卸载也始终保留部署出的容器、数据库、Nginx 和证书。

已退役的 `mcp`、`setup`、`profile`、`doctor`、`tools` 等不是本插件可用的业务/MCP 功能；不要靠旧别名启动脚本、恢复历史 Profile 或获取凭据。

源码核对位置：`plugins/slothvault/bin/slothvault.js`、`plugins/slothvault/lib/{package-service,skill-service,deploy-runner}.js`、`lib/commands/update.js`。
