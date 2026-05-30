# SlothTool

SlothTool 是一个默认以全屏 TUI 运行、同时保留脚本化 CLI 能力的轻量级插件管理器。

根包通过 npm 分发，官方插件通过 GitHub Release 源码包分发。当前仓库只保留一个官方插件：`loc`。

## Highlights

- 默认入口是 Ink 全屏 TUI：直接执行 `slothtool`
- 所有能力仍保留显式 CLI：`install`、`list`、`update`、`config`、`run`
- 官方插件安装到 `~/.slothtool/plugins/`
- 根管理器和官方插件都支持默认 TUI + 显式 CLI
- 双语支持：中文 / English
- 根 TUI 的标签栏、状态栏和帮助提示会跟随当前语言切换

## Requirements

- Node.js >= 22
- npm >= 10

## Install

```bash
npm install -g @holic512/slothtool
```

验证安装：

```bash
slothtool --help
slothtool
```

## Quick Start

```bash
# 默认进入根 TUI
slothtool

# 安装唯一官方插件
slothtool install loc

# 无参数默认进入插件 TUI
slothtool loc

# 显式 CLI 统计
slothtool loc ./src
slothtool loc -v ./src
```

## Core Commands

```bash
slothtool
slothtool tui
slothtool install loc
slothtool list
slothtool update loc
slothtool --update-all
slothtool uninstall loc
slothtool config language zh
slothtool config language en
slothtool self-update
slothtool --uninstall-all
```

## Official Plugin: `loc`

`loc` 用于统计目录中的代码行数。

```bash
# 默认进入 loc TUI
slothtool loc
loc

# CLI 统计
slothtool loc .
loc ./src
loc -v ./src

# CLI 配置
loc --config
loc config show
loc config ext md off
loc config exclude dist on
loc config reset
```

## How It Works

1. `slothtool install loc` 读取内置官方插件清单。
2. SlothTool 从 GitHub Release 下载插件 `.tgz` 资产。
3. 资产被解压到 `~/.slothtool/plugins/<alias>/`，并安装生产依赖。
4. 插件入口、版本和来源信息写入 `~/.slothtool/registry.json`。
5. `slothtool <plugin>` 会从注册表解析插件入口；无额外参数时优先进入插件默认 TUI。

## Data Layout

```text
~/.slothtool/
├── settings.json
├── registry.json
├── plugins/
│   └── loc/
└── plugin-configs/
    └── loc.json
```

## Repository Layout

```text
SlothTool/
├── bin/                     # Root CLI entry
├── lib/                     # Root services, commands, and TUI
├── plugins/
│   ├── loc/                 # Official plugin workspace
│   └── template-basic/      # Scaffold only
├── README.md
├── PLUGIN_DEVELOPMENT.md
├── LOCAL_BUILD_GUIDE.md
└── package.json
```

## Development

```bash
npm install
npm link
node bin/slothtool.js --help
node plugins/loc/bin/loc.js --help
```

更多说明见：

- [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)
- [LOCAL_BUILD_GUIDE.md](./LOCAL_BUILD_GUIDE.md)
