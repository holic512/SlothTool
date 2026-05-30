# SlothTool

SlothTool 是一个默认以全屏 TUI 运行、同时保留脚本化 CLI 能力的轻量级插件管理器。

根包通过 npm 分发，官方插件通过 GitHub Release 源码包分发。当前仓库只保留一个官方插件：`loc`。

## Highlights

- 默认入口是 Ink 全屏 TUI：直接执行 `slothtool`
- 根 TUI 固定导航为：`首页 / 运行 / 安装 / 更新 / 卸载 / 设置`
- 所有能力仍保留显式 CLI：`install`、`list`、`update`、`config`、`run`
- 官方插件安装到 `~/.slothtool/plugins/`
- 根管理器和官方插件都支持默认 TUI + 显式 CLI
- 双语支持：中文 / English
- 根 TUI 使用固定单行导航头部与状态栏，并跟随当前语言切换
- 从根 TUI 启动插件后，插件退出会自动返回根 TUI，并恢复到离开前的位置
- 支持全局代理与 GitHub 源配置，默认预填 Clash `127.0.0.1:7980`
- `loc` 插件的扩展名与排除目录页支持固定分页浏览

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
slothtool config proxy show
slothtool config proxy enabled on
slothtool config proxy port 7890
slothtool config proxy github official
slothtool config proxy github-url https://proxy.example.com
slothtool self-update
slothtool --uninstall-all
```

## Network Settings

默认设置会写入 `~/.slothtool/settings.json`：

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

常见配置：

```bash
# 查看当前语言、代理与 GitHub 源
slothtool config

# 打开 Clash 代理
slothtool config proxy enabled on

# 在 7980 / 7890 端口之间切换时，也可以直接显式设置
slothtool config proxy port 7890

# 切换为官方 GitHub
slothtool config proxy github official

# 写入自定义 GitHub 代理地址，并自动切换到 custom
slothtool config proxy github-url https://proxy.example.com
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
