# SlothTool

SlothTool 是一个 TUI-first 的插件管理器：日常使用默认进入 Ink 全屏界面，同时保留可脚本化的 CLI 命令。

根包通过 npm 分发，官方插件通过 GitHub Release `.tgz` 资产安装到本机用户目录。当前内置官方插件为 `loc`、`image-compress`、`gstore`、`pzip` 和 `slothvault`。

```bash
npm install -g @holic512/slothtool
slothtool
```

## Overview

SlothTool 把“插件管理器”作为默认交互入口：根命令负责安装、更新、卸载和调度插件；插件自身继续保留独立命令与 TUI。这样日常操作可以在全屏界面完成，自动化脚本仍然可以直接调用稳定的 CLI。

## Features

| 能力 | 说明 |
| --- | --- |
| 默认 TUI | `slothtool` 无参数启动根管理器全屏 TUI。 |
| CLI 兼容 | `install`、`list`、`update`、`config`、`run`、`self-update` 等命令可直接脚本化调用。 |
| 官方插件分发 | 内置官方插件清单，支持 GitHub Release 在线安装与经过包名校验的离线 `.tgz` 安装。 |
| 离线归档 | `slothtool bundle` 可把已安装且运行时依赖完整的官方插件打包为可迁移归档。 |
| 平台资产选择 | `image-compress` 按当前系统和 CPU 架构选择匹配的预编译后端资产。 |
| 配置云同步 | `gstore` 通过独立 Git 仓库缓存同步全局设置、插件配置和数据，并提供冲突检测与显式覆盖策略。 |
| 项目 ZIP 压缩 | `pzip` 递归创建 ZIP，默认过滤 macOS、构建产物与 Git 元数据，并应用嵌套 `.gitignore`。 |
| SlothVault 管理界面 | `sv`/`slothvault` 提供 TUI、安装更新与命令适配；Vault 仓库分别发布 MCP Client、Skill 和 Deployment 三包。注册后的 `slothvault-mcp` 动态发现管理员 MCP 能力并执行带风险确认的调用。 |
| 双语界面 | 根管理器和官方插件支持中文 / English 文案。 |
| 本地用户数据 | 设置、注册表、插件包、插件配置和同步数据都保存在 `~/.pipker/slothtool/`。 |

## Requirements

- Node.js `>=22.0.0`
- npm `>=10`

## Install

```bash
npm install -g @holic512/slothtool
```

验证入口：

```bash
slothtool --help
slothtool
```

## Quick Start

启动根 TUI：

```bash
slothtool
```

安装并运行官方插件：

```bash
slothtool install loc
slothtool install image-compress
slothtool install gstore
slothtool install pzip
slothtool install slothvault

slothtool loc
slothtool image-compress
slothtool gstore
slothtool pzip
slothtool sv
```

使用显式 CLI：

```bash
slothtool loc ./src
slothtool loc -v ./src

slothtool image-compress ./photo.jpg --dry-run
slothtool image-compress -r ./album --output-dir ./compressed

slothtool gstore repo set holic512/my-private-data --create
slothtool gstore status
slothtool gstore sync

slothtool pzip ./my-project
slothtool pzip ./my-project --exclude "logs/" --dry-run

slothtool sv mcp register
slothvault-mcp profile add intranet --url http://vault.internal --default
slothvault-mcp doctor
slothvault-mcp tools list
```

## TUI Pages

根 TUI 的页面模型固定为：

| 页面 | 主要职责 |
| --- | --- |
| Home | 显示当前工作目录；有插件时快速启动最近使用的最多三个插件，无插件时直接进入官方安装目录。 |
| Run | 浏览已安装插件的版本、来源和能力，并启动插件 TUI 或 CLI 能力；空列表可按 Enter 前往安装页。 |
| Install | 浏览内置官方插件的说明和能力，安装成功后可按 Enter 立即启动该插件。 |
| Update | 先检查可更新项，再对照状态、当前版本和最新版本执行单项或批量更新。 |
| Uninstall | 对照插件信息与移除范围卸载插件，并单独标记全量数据清理风险。 |
| Settings | 对照当前值与待应用值，切换语言、代理及 GitHub 源；代理主机、任意有效端口和自定义下载源通过草稿编辑。 |

Home 恢复居中的青紫 Logo 和单次入场动画，下方保留当前目录、最近插件与安装快捷入口；低高度或窄窗口收起大型 Logo，并始终显示选中的入口。其余管理页面在宽终端使用“左侧选择、右侧详情”的双栏布局，在窄终端自动合并为单面板。列表、状态徽标和详情字段保留高对比配色，列表会按实际终端高度翻页并保持选中项可见；终端小于 44 列或 11 行时会提示扩大窗口。按 `v` 可翻阅选中项的完整说明、路径、来源与错误，使用方向键或 Page Up / Page Down 翻页，按 Esc 返回。

根管理器及官方插件可用 Tab / Shift+Tab 正反向切页；↑↓ 操作当前列表或详情，Space 切换开关，底栏说明 Enter 当前会执行的动作。Esc 先关闭正在编辑的表单、确认、帮助或详情，再返回页面。文本输入支持 ←→、Home/End、Backspace、Delete、Ctrl+U 和终端粘贴；长文本沿光标横向滚动，按 `v` 可查看当前页的完整路径、说明或错误。输入中的 `q`、`y` 和 Tab 由表单接管。状态符号与文字会在无颜色终端中保留。

底栏在空间足够时左侧显示状态、右侧显示按键；空间不足时自动分成两行，并相应减少内容区高度。任务经过准备、执行、成功、部分失败或失败阶段；结果不会因短暂计时自动清除。按 `f` 可回看本次管理器会话中的任务反馈和逐目标结果。执行期间按键栏只提示等待，不提供无效的取消操作。

pzip 在宽屏中使用任务／结果、内置／自定义规则双面板；窄屏保留当前操作和精简摘要，预演与完整结果仍可通过快捷键查看。各插件的详情会随终端缩放重新换行，输入框优先获得足够空间。

卸载会先在内容区展示目标和移除范围；普通插件按 `y` 确认，按 `n` 或 Esc 取消。清理全部本地数据还需要输入 `DELETE ALL` 并按 Enter，默认不会执行。Update 页仍须先检查，再更新；批量更新后可在“最近一次批量更新结果”或任务反馈中查看每个目标及失败原因。

官方插件的危险操作同样要求明确的 `y`，普通 Enter 不会在确认层继续执行。插件任务执行期间按键栏只展示真实可用操作；SlothVault 部署程序的提示输入可向 Python 服务发送取消请求，强制退出进程不作为安全取消。SlothVault MCP Key 仅在受保护表单中以掩码编辑，不进入普通详情或会话回看。

Run 页面会把最近运行的插件排在前面，未运行过的插件继续按别名稳定排序。插件退出后会返回根 TUI，并聚焦刚刚运行、已经移动到列表首位的插件。

Home 的最近插件入口也按此顺序排列。从 Home、Run 或安装成功页启动插件时，插件退出会回到原来的根管理器页面；安装成功页按 Esc 返回官方目录。Settings 中代理端口可直接选用 `7980`、`7890`，也可输入 `1–65535` 的其他整数；GitHub 下载源可选官方、`gh-proxy.com`，或编辑自定义 HTTP(S) 地址。打开编辑器只显示已保存值和待保存草稿，不写入配置；按 Enter 校验并保存，按 Esc 取消。非法端口、主机或 URL 会保留草稿供修正，配置保持原值。

跨包的 Unicode 宽度、字素编辑和文本视窗由 `lib/tui/shared-interaction.js` 维护。执行 `npm run sync:tui-interaction` 将它同步到五个官方插件各自的 `lib/shared-interaction.js`；插件发行包自带该文件，运行时不依赖根包源码。`npm run check:tui-interaction` 检查副本一致性，`node --test test/tui-packaging.test.js` 实际打包根包与五个插件，并在隔离目录启动每个发行入口。

## Commands

| 命令 | 用途 |
| --- | --- |
| `slothtool` | 启动根全屏 TUI。 |
| `slothtool tui` | 显式启动根全屏 TUI。 |
| `slothtool install <alias>` | 从 GitHub Release 安装内置官方插件。 |
| `slothtool install <alias> --file <archive.tgz>` | 从经过 alias 与包名校验的本地归档安装官方插件；`slothvault` 另需联网获取三个 Vault 包。 |
| `slothtool bundle <alias> [--output <archive.tgz>]` | 将已安装官方插件和已有运行时依赖打包为归档；`slothvault` 归档仅含界面。 |
| `slothtool uninstall <alias>` | 卸载指定插件。 |
| `slothtool update <alias>` | 更新指定插件。 |
| `slothtool --update-all` | 更新全部可更新目标。 |
| `slothtool list` | 查看已安装插件。 |
| `slothtool run <plugin> [args]` | 运行指定插件。 |
| `slothtool <plugin> [args]` | 插件简写运行方式。 |
| `slothtool config <...>` | 管理语言、代理和 GitHub 源。 |
| `slothtool self-update` | 更新根管理器包。 |
| `slothtool --uninstall-all` | 删除 SlothTool 用户数据与已安装插件。 |

## Official Plugins

| Alias | Package | 能力 | 入口 |
| --- | --- | --- | --- |
| `loc` | `@holic512/plugin-loc` | 统计目录代码行数、文件类型过滤、排除目录配置、详细模式。 | `slothtool loc` / `loc` |
| `image-compress` | `@holic512/plugin-image-compress` | JPEG / PNG 图片压缩、目录批处理、拖拽路径 TUI、多平台 Go 后端资产。 | `slothtool image-compress` / `image-compress` |
| `gstore` | `@holic512/plugin-gstore` | GitHub CLI 登录、独立 Git 缓存、设置/插件配置/数据全量同步、冲突检测和显式覆盖策略。 | `slothtool gstore` / `gstore` |
| `pzip` | `@holic512/plugin-pzip` | ZIP 目录压缩、递归过滤 `.DS_Store`/`__MACOSX`/`dist`/`target`/`.git`、嵌套 `.gitignore` 与规则配置。 | `slothtool pzip` / `pzip` |
| `slothvault`（简写 `sv`） | `@holic512/plugin-slothvault` | 管理界面、三包独立安装更新、独立 MCP 命令注册；业务内容由 Vault 分包提供。 | `slothtool sv` / 注册后的 `slothvault-mcp` |

### `loc`

```bash
slothtool install loc

slothtool loc
slothtool loc .
slothtool loc -v ./src

loc config show
loc config ext md off
loc config exclude dist on
loc config reset
```

`loc` TUI 会根据终端宽高在双栏、上下堆叠和低高度单面板之间切换。统计结果优先展示文件数、总行数、扩展名分布与热点文件；扩展名和排除目录页面则展示当前规则状态、匹配范围与动态分页列表。

### `pzip`

```bash
slothtool install pzip

slothtool pzip
slothtool pzip ./my-project
slothtool pzip ./my-project --output ./releases/my-project
slothtool pzip ./my-project --exclude "logs/" --exclude "*.log" --dry-run
pzip config rule target off
pzip config add "reports/"
```

`pzip` 默认把目录递归写入 ZIP，并将源目录名作为压缩包最外层目录。任意层级中的 `.DS_Store`、`__MACOSX`、`dist`、Java 构建 `target` 和 `.git` 默认过滤；根目录和每个子目录中的 `.gitignore` 都会按各自相对路径生效。启用的默认规则优先于 `.gitignore` 的否定规则。配置保存在 `~/.pipker/slothtool/plugin-configs/pzip.json`，同名 ZIP 会自动改用时间戳文件名，避免覆盖已有归档。

### `image-compress`

```bash
slothtool install image-compress

slothtool image-compress
slothtool image-compress ./photo.jpg
slothtool image-compress ./photo.jpg --dry-run --json
slothtool image-compress -r ./album --output-dir ./compressed
```

常用压缩参数包括 `--quality`、`--max-width`、`--max-height`、`--overwrite`、`--allow-larger`、`--concurrency`、`--dry-run`、`--json` 和 `--quiet`。

`image-compress` TUI 围绕输入队列、执行方案、压缩收益和异常文件组织任务。宽终端使用操作侧栏与输入/结果主区，窄终端按工作流纵向排列，低高度终端自动收起次要结果；选项页会按高度分页并解释当前参数的实际影响。

### `gstore`

```bash
slothtool install gstore

slothtool gstore
slothtool gstore auth
slothtool gstore repo set holic512/my-private-data --create
slothtool gstore status
slothtool gstore pull
slothtool gstore push -m "sync SlothTool configuration"
slothtool gstore sync
slothtool gstore conflicts --json
```

`gstore` 使用 `~/.pipker/slothtool/cache/gstore/repository` 作为独立 Git 工作区，不会在实际数据目录中创建 `.git`。默认同步三个系统范围：`settings.json`、`plugin-configs/`（排除保存远端地址和同步基线的 `gstore.json`）以及 `data/`；`registry.json`、已安装插件和缓存不会跨设备同步。需要附加其他工具目录时，可继续使用 `gstore bind <tool> <name> <localDir>`。

它只调用本机 `git` 和 GitHub CLI `gh`，不保存 GitHub token。默认遇到同文件双向修改会停止；确认取舍后使用 `gstore sync --prefer-remote` 或 `gstore sync --prefer-local` 显式解决。新设备已有默认设置文件时，首次恢复使用 `gstore pull --prefer-remote`。TUI 对覆盖动作提供二次确认。

### `slothvault`

```bash
slothtool install slothvault
slothtool sv
slothtool update slothvault --check
slothtool update slothvault --module mcp-client
slothtool sv mcp register

slothtool slothvault
slothtool slothvault deploy
slothtool slothvault skill status
slothtool slothvault mcp status
slothvault-mcp profile add production --url https://vault.example.com --default
slothvault-mcp doctor --profile production
slothvault-mcp tools list --profile production
slothvault-mcp tools show TOOL_NAME --profile production
slothvault-mcp tools call TOOL_NAME --args '{}' --profile production --yes --json
slothvault-mcp prompts list --profile production
slothvault-mcp prompts get PROMPT_NAME --args '{}' --profile production
slothvault-mcp resources list --profile production
slothvault-mcp resources read RESOURCE_URI --output ./artifact.bin --profile production
slothvault-mcp history list
slothvault-mcp storage status --json
```

多功能入口包括 `deploy`、`skill status|install|uninstall` 与 `mcp status|register|unregister`。它不会转发 `profile`、`doctor`、Tool、Prompt、Resource、History 或 Storage 参数；这些 MCP 调用会明确提示改用已注册的独立命令。独立 `slothvault-mcp` 命令组包括 `profile add|update|list|show|use|remove`、`doctor`、`tools list|show|call`、`prompts list|get`、`resources list|read`、`history list|show|clear` 与只读的 `storage status`。JSON 参数可由 `--args` 或 `--args-file <path|->` 提供；凭据只通过隐藏输入、`--key-stdin` 或 `--key-env` 接收，不提供会泄漏到进程参数和 shell 历史中的 `--key`。

`slothtool slothvault` 的全屏管理页默认展示当前部署目录的受管状态、数据库、镜像、端口、数据目录、容器运行及健康状态。按 `e` 切换部署目录，按 `r` 刷新。通过 Tab 进入“部署”，用 ↑↓ 选择安装、状态、检查更新、更新、启停、Nginx、HTTPS 或证书续约，按 Enter 执行；检查更新后可用 `[` / `]` 翻阅直到最新正式版本的全部提交说明。按 `m` 切换系统级或官方 Docker Nginx 模式，Docker 模式按 `c` 输入容器名。配置输入、确认与执行进度在 TUI 内完成，操作结束后刷新实例；CLI 仍可直接调用相同的 Python 部署服务。需要管理员权限时以保留用户 HOME 的 `sudo env HOME="$HOME" "$(command -v slothtool)" slothvault` 启动管理页。

旧的 `slothtool slothvault-mcp …` 仍是带迁移提示的兼容入口：普通 MCP 参数会转发给独立 `slothvault-mcp` executable，而旧 `skill …` 参数会转发给 `slothtool slothvault skill …`。新脚本应只使用规范的 `slothvault` 插件别名和已注册的独立 MCP 命令。

`--json` 成功时只输出一个 JSON 文档，警告写入 stderr。稳定退出码为：`0` 成功、`2` 用法/配置/缺少确认、`3` 认证失败、`4` 网络/超时/服务或协议失败、`5` MCP 业务失败、`1` 其他内部错误。

Vault 独立 MCP Client 包中的 Python 客户端先检查受认证保护的兼容接口，再通过 MCP 初始化与实时发现读取 Tool、Prompt 和 Resource Template，不硬编码业务清单。只有 `annotations.readOnlyHint === true` 的 Tool 会被视为只读；其他 Tool 在交互终端执行前要求确认，在非 TTY、`--json` 或 stdin 参数模式下必须显式传入 `--yes`。Prompt 只获取并展示 MCP messages，不自动执行其中描述的 Tool。`slothtool slothvault` 的 MCP 页面可查看连接状态、能力与脱敏历史，并管理本地 Profile；它不执行 Tool、获取 Prompt 内容或读取 Resource。`slothvault-mcp` 无参数时显示帮助。已授权的任务使用 `--yes` 连续执行，无需每一步重新确认。

Vault 独立 Skill 包含有 `slothvault-mcp` Skill，也可从仓库手动复制。通过 `slothtool slothvault skill install` 会检测 Codex 与 Claude Code，并只在已检测智能体自己的目录创建链接：Codex 使用 `$CODEX_HOME/skills/slothvault-mcp`（默认 `~/.codex/skills/slothvault-mcp`），Claude Code 使用 `$CLAUDE_CONFIG_DIR/skills/slothvault-mcp`（默认 `~/.claude/skills/slothvault-mcp`）；不再向 `~/.agents/skills` 新装链接。若目标有自定义内容，自动更新会保留并报告冲突；显式安装时非交互或 `--json` 模式只有指定 `--yes` 才能覆盖。卸载只删除当前或旧版的已识别受管链接。未出现 Skill 时请重启对应智能体。

TUI 的 Profile 表单不会载入现有明文 Key，也不会显示本次输入的新 Key；编辑时 Key 留空会保留原值。配置变更不会自动连接服务端，默认 Profile 或连接参数变化后需按 `r` 重新发现能力。

配置保存在 `~/.pipker/slothtool/plugin-configs/slothvault.json`，其中 Bearer Key 为明文；历史保存在 `~/.pipker/slothtool/data/slothvault/history.json`，只记录脱敏摘要，不保存完整参数、完整结果或 Resource 内容。首次使用时，旧 MCP-only 路径只会在新位置不存在时原子迁移；两者同时存在时绝不覆盖或合并。`slothvault-mcp storage status --json` 只报告各路径状态，不读取或打印任何 Key、Profile 或历史正文。若根命令输出 `SLOTHVAULT_PLUGIN_UPGRADE_REQUIRED`，说明旧 MCP-only 包仍处于规范别名下；先执行 `slothtool update slothvault`，重新注册 `slothvault-mcp`，再使用独立命令配置或诊断。`gstore` 默认会同步 `plugin-configs/` 和 `data/`，因此其私有同步仓库可能包含明文 Key 与脱敏历史元数据。优先使用 HTTPS；HTTP endpoint 可以用于受控内网，但插件会持续显示明文传输警告。

读取 Resource 时必须显式指定 `--output`，目标文件已存在则拒绝覆盖。插件只接受 SlothVault 受保护的 Resource URI，校验 MIME、Base64、大小及 `_meta["slothvault/file-name"]` 文件名后再原子落盘，并兼容旧服务端的顶层 `name` 字段；托管文件上限为 10 MiB，合同附件上限为 25 MiB，Resource Base64 不会打印到终端。

需要管理员权限管理 `/data`、Nginx 或 Certbot 时，使用 `sudo env HOME="$HOME" "$(command -v slothtool)" slothvault deploy …`，以保留安装用户的 SlothTool 数据目录。注册独立 MCP 命令时不会覆盖同名用户命令；非交互替换需要 `--replace --yes`。`slothtool uninstall slothvault` 删除界面、运行包和已验证的受管链接，保留 Profile/Key 和脱敏历史；需要删除历史时先执行 `slothvault-mcp history clear --yes`。

## Offline Plugin Archives

从本地归档安装仍只允许内置官方 alias，并会校验归档内 `package.json` 的包名：

```bash
slothtool install loc --file ./loc-offline.tgz
```

在已安装插件且运行时依赖完整的机器上创建自包含归档：

```bash
slothtool bundle loc --output ./loc-offline.tgz
```

离线归档使用 `package/` 根布局。若归档没有 `node_modules` 但声明了依赖，安装器只会尝试 `npm install --omit=dev --offline`；npm 缓存不完整时会失败并提示先在联网机器上执行 `slothtool bundle`。`slothvault` 是例外：它的归档只含界面，安装时必须联网取得 Vault 的 MCP Client、Skill 和 Deployment 三个独立包。

## Configuration

全局设置默认保存在 `~/.pipker/slothtool/settings.json`：

```json
{
  "language": "zh",
  "network": {
    "proxy": {
      "enabled": false,
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 7980,
      "noProxy": "localhost,127.0.0.1,::1"
    },
    "github": {
      "preset": "gh-proxy",
      "customBaseUrl": ""
    }
  }
}
```

常用配置命令：

| 命令 | 说明 |
| --- | --- |
| `slothtool config` | 查看语言、代理和 GitHub 源摘要。 |
| `slothtool config language zh` | 切换为中文。 |
| `slothtool config language en` | 切换为 English。 |
| `slothtool config proxy show` | 查看网络配置。 |
| `slothtool config proxy enabled on` | 启用代理。 |
| `slothtool config proxy enabled off` | 关闭代理。 |
| `slothtool config proxy host 127.0.0.1` | 设置代理主机。 |
| `slothtool config proxy port 7890` | 设置代理端口。 |
| `slothtool config proxy github official` | 使用官方 GitHub 源。 |
| `slothtool config proxy github gh-proxy` | 使用内置 GitHub 代理预设。 |
| `slothtool config proxy github-url https://proxy.example.com` | 写入自定义 GitHub 代理地址，并切换到 `custom`。 |

## Architecture

```mermaid
flowchart TD
    A["slothtool CLI"] --> B{"Has command?"}
    B -- "No" --> C["Root Ink TUI"]
    B -- "Root command" --> D["Command handlers"]
    B -- "Plugin alias" --> E["Plugin runner"]
    C --> D
    D --> F["Plugin service"]
    F --> G["official-plugins.json"]
    F --> H["GitHub Release or offline .tgz"]
    F --> I["~/.pipker/slothtool/registry.json"]
    F --> J["~/.pipker/slothtool/plugins/<alias>/"]
    E --> I
    E --> K["Plugin bin"]
    K --> L{"No args / --tui?"}
    L -- "Yes" --> M["Plugin Ink TUI"]
    L -- "No" --> N["Plugin CLI behavior"]
```

安装流程：

1. `slothtool install <alias>` 或 `install <alias> --file <archive.tgz>` 从 `lib/official-plugins.json` 查找内置官方插件。
2. 在线安装按插件策略、当前平台和 CPU 架构选择 GitHub Release `.tgz`；本地归档安装校验包名。`slothvault` 另行下载并校验 Vault MCP Client、Skill 和 Deployment 三个独立包。
3. 界面插件被部署到 `~/.pipker/slothtool/plugins/<alias>/`；SlothVault 三包分别部署到 `~/.pipker/slothtool/runtimes/slothvault/components/<module>/releases/<version>/`，经验证后切换各自的 `current` 指针。
4. 插件入口、版本和来源类型写入 `~/.pipker/slothtool/registry.json`。
5. `slothtool <plugin>` 从注册表解析插件入口；无额外参数时优先进入插件默认 TUI。

## Data Layout

```text
~/.pipker/slothtool/
├── settings.json
├── registry.json
├── data/
│   ├── slothvault/
│   │   └── history.json
│   └── <plugin-data>/
├── cache/
│   └── gstore/
│       └── repository/
│           ├── .git/
│           └── system/
├── plugins/
│   ├── image-compress/
│   ├── gstore/
│   ├── loc/
│   └── slothvault/
├── runtimes/
│   └── slothvault/
│       └── components/
│           ├── mcp-client/
│           ├── skill/
│           └── deployment/
└── plugin-configs/
    ├── gstore.json
    ├── slothvault.json
    └── <plugin-config>.json
```

SlothVault Skill 安装在 SlothTool 数据目录之外：已检测到 Codex 时链接到 `~/.codex/skills/slothvault-mcp`，已检测到 Claude Code 时链接到 `~/.claude/skills/slothvault-mcp`；受管链接指向 `~/.pipker/slothtool/runtimes/slothvault/components/skill/current/slothvault-mcp`。旧整包目录仍保留作迁移回退来源。

## Repository Layout

```text
SlothTool/
├── bin/                     Root CLI entry
├── lib/                     Root commands, services, settings, i18n, and TUI
├── plugins/
│   ├── loc/                 Official LOC plugin workspace
│   ├── image-compress/      Official image compression plugin workspace
│   ├── gstore/              Official GitHub data sync plugin workspace
│   ├── pzip/                Official filtered ZIP archive plugin workspace
│   ├── slothvault/          Official SlothVault multifunction plugin workspace
│   └── template-basic/      Plugin scaffold template
├── test/                    node:test regression suite
├── PLUGIN_DEVELOPMENT.md    Plugin contract and development notes
├── LOCAL_BUILD_GUIDE.md     Local build and release validation notes
└── package.json
```

## Development

```bash
npm install
npm link

node bin/slothtool.js --help
node plugins/loc/bin/loc.js --help
node plugins/image-compress/bin/image-compress.js --help
node plugins/gstore/bin/gstore.js --help
node plugins/pzip/bin/pzip.js --help
node plugins/slothvault/bin/slothvault.js --help
node plugins/slothvault/bin/slothvault-mcp.js --help
```

Focused checks:

```bash
node --check bin/slothtool.js
node --check lib/tui/root-tui.js
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION=exit node plugins/image-compress/bin/image-compress.js
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
SLOTHTOOL_PZIP_TUI_TEST_ACTION=exit node plugins/pzip/bin/pzip.js
SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION=exit node plugins/slothvault/bin/slothvault.js
SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION=exit node plugins/slothvault/bin/slothvault-mcp.js
```

Full regression:

```bash
npm test
```

More project docs:

- [Plugin development](./PLUGIN_DEVELOPMENT.md)
- [Local build guide](./LOCAL_BUILD_GUIDE.md)

## License

ISC, as declared in [package.json](./package.json). This repository does not currently include a standalone `LICENSE` file.

### SlothVault 快速连接与 Skill 更新

首次进入 SlothVault TUI 展示“连接 SlothVault”，只输入服务器地址和访问密钥；已有配置可在概览按 `c` 重新连接，高级 Profile 管理保留。CLI 使用同一服务：

```bash
slothtool slothvault setup --url https://vault.example --key-env SLOTHVAULT_KEY
slothvault-mcp setup --url https://vault.example --key-stdin
slothtool slothvault skill status --json
slothtool slothvault skill status --check --json
slothtool slothvault skill update
slothtool slothvault skill update --local
slothtool update slothvault --check --json
```

`setup` 自动补全 `/mcp`、复用同地址连接，并保留其他连接。保存后检测服务，连接失败时明确报告“配置已保存”。完整管理入口同时注册受管命令并安装已检测智能体的 Skill，自定义冲突保留。

MCP Client、Skill 与 Deployment 分别使用 Vault 的 `mcp-client-vX.Y.Z`、`skill-vX.Y.Z` 和 `deployment-vX.Y.Z` Release；SlothTool 界面另有插件版本。每包清单记录归档与文件 SHA-256 和桥协议主版本。`slothtool update slothvault` 检查并更新三包及界面，`--module` 可逐包操作；`--local` 只同步当前已安装 Skill 的链接。旧受管链接和缺失链接可修复，自定义文件保持原状。TUI 的 Skill 页按 `c` 检查、`n` 更新，并显示当前和最新版本；网络失败显示“未能检查”。

MCP 业务错误保留脱敏后的 `reason`、实体 ID 和校验问题；例如目标非空或正文已发布，不再只显示通用错误。Skill 对已授权任务连续完成准备、编辑、校验、发布与回查，正文使用具体项目事实，并优先使用 `loc`、`pzip` 和已有附件。
