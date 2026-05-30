# Plugin Development Guide

本仓库保留一个官方插件工作区 `plugins/loc` 和一个脚手架目录 `plugins/template-basic`。

## Design Rule

SlothTool 现在采用：

- 默认入口是插件自己的全屏 TUI
- 显式 CLI 子命令或参数负责脚本化与自动化
- 业务能力先落在无 UI 的底层逻辑，再由 TUI 复用

## Quick Start

```bash
cp -R plugins/template-basic my-plugin
cd my-plugin
```

然后更新：

- `package.json`
- `bin/mytool.js`
- `lib/i18n.js`
- `lib/config.js`
- `lib/interactive.js`

## Minimum Contract

每个插件至少应包含：

1. `package.json`
2. `bin` 字段
3. 以 `#!/usr/bin/env node` 开头的入口文件
4. `slothtool.ui` 元数据

示例：

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "mytool": "bin/mytool.js"
  },
  "slothtool": {
    "interactive": true,
    "interactiveFlag": "-i",
    "ui": {
      "cli": true,
      "tui": true,
      "defaultMode": "tui",
      "tuiFlag": "--tui",
      "compatFlags": ["-i", "--interactive"]
    }
  }
}
```

## Recommended Layout

```text
my-plugin/
├── bin/
│   └── mytool.js
├── lib/
│   ├── config.js
│   ├── i18n.js
│   └── interactive.js
├── README.md
└── package.json
```

## Current Reference Package

优先参考 `plugins/loc` 来实现：

- 默认 TUI 入口
- 显式 CLI 统计/配置命令
- 插件配置落盘
- 双语输出

## TUI Shell Standard

插件默认全屏 TUI 应与根管理器保持一致的外壳结构：

- 顶部使用单行 tab 栏，右侧显示 `v<version>` 和当前工作目录
- tab 下方保留一条分割线
- 底部使用单行状态栏：左侧放状态消息，右侧放快捷键帮助
- `Tab` 优先切换顶部页面；`Esc` 返回主页面；`q` 退出；`?` 打开帮助
- 业务结果详情放在正文面板中，状态栏只承载短消息、加载态和错误反馈

## Local Development

```bash
node bin/mytool.js --help
node bin/mytool.js
node bin/mytool.js --tui
SLOTHTOOL_TEMPLATE_TUI_TEST_ACTION=exit node bin/mytool.js
```

`loc` 参考命令：

```bash
node plugins/loc/bin/loc.js
node plugins/loc/bin/loc.js ./src
node plugins/loc/bin/loc.js config show
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
```

## Integration Notes

SlothTool 当前只安装内置官方插件：

- `slothtool install loc` 可用，因为 `loc` 定义在 `lib/official-plugins.json`
- 任意第三方插件安装暂不属于当前产品范围

如果未来新增官方插件，需要同步更新：

- `lib/official-plugins.json`
- `.github/workflows/release-plugins.yml`
- 用户文档

## Config & I18N

- 全局语言配置：`~/.slothtool/settings.json`
- 插件配置目录：`~/.slothtool/plugin-configs/<alias>.json`

## Publishing Model

- 根包 `@holic512/slothtool` 从仓库根目录发布
- 官方插件 `@holic512/plugin-loc` 通过 `npm pack` 生成 GitHub Release 资产
- `plugins/template-basic` 不发布
