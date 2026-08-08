# SlothTool

SlothTool 是一个 TUI-first 的插件管理器：日常使用默认进入 Ink 全屏界面，同时保留可脚本化的 CLI 命令。

根包通过 npm 分发，官方插件通过 GitHub Release `.tgz` 资产安装到本机用户目录。当前内置官方插件为 `loc`、`image-compress`、`gstore`、`todo` 和 `codex-models`。

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
| 数据同步 | `gstore` 可把 `~/.slothtool/data` 绑定到 GitHub private repo，并同步插件配置和项目数据。 |
| TodoList | `todo` 将任务拆成独立 JSON 文件，并通过 `gstore` 手动同步。 |
| Codex 模型管理 | `codex-models` 诊断自定义 provider，同步跨厂商模型库、上下文与推理等级，并生成 Desktop 离线修复脚本。 |
| 双语界面 | 根管理器和官方插件支持中文 / English 文案。 |
| 本地用户数据 | 设置、注册表、插件包、插件配置和同步数据都保存在 `~/.slothtool/`。 |

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
slothtool install todo
slothtool install codex-models

slothtool loc
slothtool image-compress
slothtool gstore
slothtool todo
slothtool codex-models
```

使用显式 CLI：

```bash
slothtool loc ./src
slothtool loc -v ./src

slothtool image-compress ./photo.jpg --dry-run
slothtool image-compress -r ./album --output-dir ./compressed

slothtool gstore repo set holic512/my-private-data --create
slothtool gstore bind todo default ~/.slothtool/data/todo/default
slothtool gstore sync todo default

slothtool todo add "Buy milk" --tag home --due today
slothtool todo list --due today
slothtool todo sync

slothtool codex-models doctor
slothtool codex-models library show gpt-5.6-sol
slothtool codex-models model set gpt-5.6-sol --reasoning ultra
```

## TUI Pages

根 TUI 的页面模型固定为：

| 页面 | 主要职责 |
| --- | --- |
| Home | 展示管理器入口信息与当前导航提示。 |
| Run | 浏览已安装插件的版本、来源和能力，并启动插件 TUI 或 CLI 能力。 |
| Install | 浏览内置官方插件的说明和能力，再执行安装。 |
| Update | 先检查可更新项，再对照状态、当前版本和最新版本执行单项或批量更新。 |
| Uninstall | 对照插件信息与移除范围卸载插件，并单独标记全量数据清理风险。 |
| Settings | 对照当前值与执行后值，切换语言、代理与 GitHub 源配置。 |

除 Home 外，管理页面在宽终端使用“左侧选择、右侧详情”的双栏布局，在窄终端自动合并为单面板，避免额外提示框占用主内容空间。

Run 页面会把最近运行的插件排在前面，未运行过的插件继续按别名稳定排序。插件退出后会返回根 TUI，并聚焦刚刚运行、已经移动到列表首位的插件。

## Commands

| 命令 | 用途 |
| --- | --- |
| `slothtool` | 启动根全屏 TUI。 |
| `slothtool tui` | 显式启动根全屏 TUI。 |
| `slothtool install <alias>` | 从 GitHub Release 安装内置官方插件。 |
| `slothtool install <alias> --file <archive.tgz>` | 从经过 alias 与包名校验的本地归档离线安装官方插件。 |
| `slothtool bundle <alias> [--output <archive.tgz>]` | 将已安装官方插件和已有运行时依赖打包为离线归档。 |
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
| `gstore` | `@holic512/plugin-gstore` | GitHub CLI 登录、私有仓库绑定、数据同步、冲突检测、手动同步 TUI。 | `slothtool gstore` / `gstore` |
| `todo` | `@holic512/plugin-todo` | 独立 JSON 任务文件、完整任务字段、列表、标签、手动 gstore 同步、默认 TUI。 | `slothtool todo` / `todo` |
| `codex-models` | `@holic512/plugin-codex-models` | 自定义 provider 诊断、跨厂商模型库、上下文和推理等级切换、目录同步、Desktop 离线修复脚本。 | `slothtool codex-models` / `codex-models` |

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
slothtool gstore bind todo default ~/.slothtool/data/todo/default
slothtool gstore status todo default
slothtool gstore pull todo default
slothtool gstore push todo default -m "sync todo"
slothtool gstore sync todo default
slothtool gstore conflicts todo default --json
```

`gstore` 固定使用 `~/.slothtool/data` 作为本地 Git 工作区。它只调用本机 `git` 和 GitHub CLI `gh`，不保存 GitHub token。同一文件在本地和远端都发生变化时，v1 会停止同步并报告冲突文件。

### `todo`

```bash
slothtool install todo

slothtool todo
slothtool todo add "Buy milk" --tag home --due today
slothtool todo list --status todo --sort due
slothtool todo show <id-prefix>
slothtool todo edit <id-prefix> --priority high --project personal
slothtool todo checklist add <id-prefix> "Prepare receipt"
slothtool todo note add <id-prefix> "Remember coupon"
slothtool todo done <id-prefix>
slothtool todo sync
```

`todo` 固定把数据写入 `~/.slothtool/data/todo/default/`。任务文件按 `tasks/<yyyy>/<mm>/<uuid>.json` 拆分，列表写入 `lists/<id>.json`，插件配置写入 `~/.slothtool/data/plugin-configs/todo.json`。同步命令依赖已安装并已绑定的 `gstore`：

```bash
slothtool install gstore
slothtool gstore bind todo default ~/.slothtool/data/todo/default
slothtool todo sync
```


### `codex-models`

```bash
slothtool install codex-models

slothtool codex-models
slothtool codex-models doctor
slothtool codex-models catalog sync
slothtool codex-models library list
slothtool codex-models library show gpt-5.6-sol
slothtool codex-models model set gpt-5.6-sol --reasoning max
slothtool codex-models reasoning set ultra
slothtool codex-models repair create gpt-5.6-sol
```

`codex-models` 会优先采用 provider `/models` 返回的显式能力，再合并 OpenAI、Claude、Gemini、Grok、DeepSeek、Qwen、Mistral、Kimi、GLM、MiniMax、Llama、Hunyuan、Baichuan、InternLM、Nemotron、Jamba、Granite、Sonar 等常见厂商兼容画像。模型详情包含上下文窗口、推理等级、默认推理等级、输入模态、联网搜索和并行工具能力；未知模型保守回退为 `low / medium / high`。`gpt-5.6-sol` 的 provider 扩展画像包含 `max` 和 `ultra`。

Desktop 修复命令只生成一次性脚本。必须完全退出 Codex 后在独立 Terminal 执行；脚本先检查 LevelDB 锁并完整备份，不修改 `app.asar`、不使用 `launchctl`、不修改 `default_model`。启用缓存冻结可减少 Statsig 立即覆盖，但会暂时冻结同一缓存身份的其他动态配置更新，详细回滚方法见 [`plugins/codex-models/README.md`](./plugins/codex-models/README.md)。

## Offline Plugin Archives

从本地归档安装仍只允许内置官方 alias，并会校验归档内 `package.json` 的包名：

```bash
slothtool install codex-models --file ./codex-models-offline.tgz
```

在已安装插件且运行时依赖完整的机器上创建自包含归档：

```bash
slothtool bundle codex-models --output ./codex-models-offline.tgz
```

离线归档使用 `package/` 根布局。若归档没有 `node_modules` 但声明了依赖，安装器只会尝试 `npm install --omit=dev --offline`；npm 缓存不完整时会失败并提示先在联网机器上执行 `slothtool bundle`。

## Configuration

全局设置默认保存在 `~/.slothtool/settings.json`：

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
    F --> I["~/.slothtool/registry.json"]
    F --> J["~/.slothtool/plugins/<alias>/"]
    E --> I
    E --> K["Plugin bin"]
    K --> L{"No args / --tui?"}
    L -- "Yes" --> M["Plugin Ink TUI"]
    L -- "No" --> N["Plugin CLI behavior"]
```

安装流程：

1. `slothtool install <alias>` 或 `install <alias> --file <archive.tgz>` 从 `lib/official-plugins.json` 查找内置官方插件。
2. 在线安装按插件策略、当前平台和 CPU 架构选择 GitHub Release `.tgz`；离线安装校验本地归档包名。
3. 资产被解包并部署到 `~/.slothtool/plugins/<alias>/`；缺少运行时依赖时只允许使用 npm 离线缓存补齐。
4. 插件入口、版本和来源类型写入 `~/.slothtool/registry.json`。
5. `slothtool <plugin>` 从注册表解析插件入口；无额外参数时优先进入插件默认 TUI。

## Data Layout

```text
~/.slothtool/
├── settings.json
├── registry.json
├── data/
│   ├── .git/
│   ├── plugin-configs/
│   │   ├── loc.json
│   │   └── todo.json
│   └── todo/
│       └── default/
│           ├── lists/
│           │   └── default.json
│           └── tasks/
│               └── <yyyy>/<mm>/<uuid>.json
├── plugins/
│   ├── image-compress/
│   ├── gstore/
│   ├── loc/
│   └── todo/
└── plugin-configs/
    └── gstore.json
```

## Repository Layout

```text
SlothTool/
├── bin/                     Root CLI entry
├── lib/                     Root commands, services, settings, i18n, and TUI
├── plugins/
│   ├── loc/                 Official LOC plugin workspace
│   ├── image-compress/      Official image compression plugin workspace
│   ├── gstore/              Official GitHub data sync plugin workspace
│   ├── todo/                Official JSON TodoList plugin workspace
│   ├── codex-models/        Official Codex model configuration plugin workspace
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
node plugins/todo/bin/todo.js --help
node plugins/codex-models/bin/codex-models.js --help
```

Focused checks:

```bash
node --check bin/slothtool.js
node --check lib/tui/root-tui.js
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION=exit node plugins/image-compress/bin/image-compress.js
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
SLOTHTOOL_TODO_TUI_TEST_ACTION=exit node plugins/todo/bin/todo.js
SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION=exit node plugins/codex-models/bin/codex-models.js
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
