# 根管理：官方插件与主程序

## 查询与安装

```sh
slothtool --help
slothtool list
slothtool install loc
slothtool install image-compress
slothtool install gstore
slothtool install pzip
slothtool install slothvault
```

只安装任务缺少的插件，不批量安装全部。官方插件来自 GitHub Release，`image-compress` 按平台选资产；主程序不是插件，缺失时不得自动 npm 安装主程序。

离线插件归档与目录 ZIP 是两种格式：

```sh
slothtool install loc --file ./loc-offline.tgz
slothtool bundle loc --output ./loc-offline.tgz
```

`--file` 仍仅接受官方别名，并校验包名。归档使用 npm-pack 兼容的 `package/` 根目录；缺生产依赖时只允许离线补齐，不可偷偷联网。`bundle` 要求已经安装的官方插件及完整运行时依赖；不能用它编译应用或把任意目录打包成插件。

显式分发示例：`slothtool run loc ./src` 与 `slothtool loc ./src`。不要省略插件参数，否则可能进入 TUI。

## 更新

```sh
slothtool update loc --check --json
slothtool update loc --json
slothtool update slothvault --check --json
slothtool update slothvault --module skill --check --json
```

先检查，再在用户授权范围更新。普通 `update slothvault` 只更新插件 UI；仅显式 `--module skill`（去掉 `--check`）才修改对应独立包，不能因 UI 更新自动安装它们。`slothtool --update-all` 是批量修改，`slothtool self-update` 修改主程序，均只在用户明确要求时执行。

## 配置

```sh
slothtool config
slothtool config proxy show
slothtool config language zh
slothtool config language en
slothtool config proxy enabled on
slothtool config proxy enabled off
slothtool config proxy host 127.0.0.1
slothtool config proxy port 7890
slothtool config proxy github official
```

前两条用于查看，后续示例会持久化更改；只执行用户要求的设置，不因网络失败擅自更改代理。根 `list`、`config` 不提供通用 JSON 输出选项。

## 主包内置 slothtool Skill

这是当前主包自带的 `slothtool` Skill，**不是** SlothVault 独立的 `slothvault-mcp` Skill 包，也不从远端下载 Skill 内容。

```sh
slothtool skill status --agent all --json
slothtool skill status --agent codex --json
slothtool skill status --agent claude-code --json
```

状态检查只读。需用户明确要求才管理对应 agent 的链接，例如：

```sh
slothtool skill install --agent codex --json
slothtool skill update --agent codex --json
slothtool skill uninstall --agent codex --json
```

四种动作均接受 `--agent codex|claude-code|all` 和 `--json`；省略 agent 默认 `all`，任务只针对一个 agent 时必须明确选择，不能扩大范围。遵循 `CODEX_HOME` / `CLAUDE_CONFIG_DIR`，目标分别位于其 `skills/slothtool`；只处理检测到的 agent。

`install` 建立受管链接；`update` 仅更新/修复既有受管链接（含有记录的缺失链接），不自动给新 agent 或未受管目标安装。需要新增目标必须单独取得 install 授权。`uninstall` 只移除验证过的受管链接，不删除用户自定义目录或主包源内容。冲突时停止报告；此命令没有覆盖冲突的 `--yes`，不能通过手工删除用户内容绕过保护。不要为当前工具任务自动安装或更新本 Skill。

## 卸载

单插件默认保留配置/历史，推荐明确写出：

```sh
slothtool uninstall loc --keep-data
```

删除插件本身也须符合用户任务。清理数据或批量卸载先展示目标与影响，再获得明确授权。非交互清理/批量调用需要 `--yes`，但这个参数不是用户授权的替代品：

```sh
slothtool uninstall loc --purge-data --yes
slothtool --uninstall-all --keep-data --yes
```

根卸载没有 `--dry-run`。必要时在非交互执行中不带 `--yes` 调用 purge/批量命令获取内置预览；其拒绝执行的非零退出是确认保护，不能作为已卸载。不要在交互终端触发确认提示流。**裸 `--uninstall-all` 没有数据标志时保留旧的完全清理语义**，不可当成保留数据的默认行为。SlothVault 卸载只处理插件受管内容，不得扩展到已部署应用、容器、数据库、Nginx 或证书。

源码核对位置（仓库内）：`bin/slothtool.js`、`lib/official-plugins.json`、`lib/commands/{install,bundle,update,config,skill,uninstall,uninstall-all,uninstall-options}.js`、`lib/services/skill-service.js`。
