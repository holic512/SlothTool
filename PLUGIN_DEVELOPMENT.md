# Plugin Development Guide

本仓库当前保留三个官方插件工作区 `plugins/loc`、`plugins/image-compress`、`plugins/gstore`，以及一个脚手架目录 `plugins/template-basic`。

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

## Cross-Platform Official Plugin Packaging

如果插件需要为不同平台分发不同资产，统一遵守以下规则：

1. 在 `lib/official-plugins.json` 中声明：
   - `assetStrategy: "platform-target"`
   - `supportedTargets`
2. `supportedTargets` 只使用标准化目标名：
   - `macos-arm64`
   - `macos-amd64`
   - `linux-amd64`
   - `linux-arm64`
   - `windows-amd64`
3. GitHub Release 资产文件名统一为：
   - `<assetNamePrefix><version>-<target>.tgz`
4. 资产解包后必须能直接定位到插件根目录：
   - 要么根目录直接包含 `package.json`
   - 要么使用 `npm pack` 风格的 `package/package.json`
5. 如果插件带预编译后端：
   - 二进制统一放在 `backend/dist/`
   - Node 包装层必须优先使用该二进制，并在源码工作区保留明确的回退策略

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

优先参考 `plugins/loc`、`plugins/image-compress` 或 `plugins/gstore` 来实现：

- 默认 TUI 入口
- 显式 CLI 统计/配置命令
- 插件配置落盘
- 双语输出

`gstore` 是需要 CLI + TUI 但核心逻辑仍独立于 Ink 的参考实现；其本地 Git 工作区固定为 `~/.slothtool/data`。

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

`gstore` 参考命令：

```bash
node plugins/gstore/bin/gstore.js --help
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
node plugins/gstore/bin/gstore.js repo status
```

## Integration Notes

SlothTool 当前只安装内置官方插件：

- `slothtool install loc`、`slothtool install image-compress`、`slothtool install gstore` 可用，因为它们定义在 `lib/official-plugins.json`
- 任意第三方插件安装暂不属于当前产品范围

如果未来新增官方插件，需要同步更新：

- `lib/official-plugins.json`
- `.github/workflows/release-plugins.yml`
- 用户文档

## Config & I18N

- 全局语言配置：`~/.slothtool/settings.json`
- gstore 同步数据目录：`~/.slothtool/data`
- 可同步插件配置目录：`~/.slothtool/data/plugin-configs/<alias>.json`
- 本机插件私有配置目录：`~/.slothtool/plugin-configs/<alias>.json`

## Publishing Model

- 根包 `@holic512/slothtool` 从仓库根目录发布
- 官方纯 Node 插件 `@holic512/plugin-loc`、`@holic512/plugin-gstore` 通过 `npm pack` 生成 GitHub Release 资产
- `@holic512/plugin-image-compress` 使用专用多平台 release workflow
- `plugins/template-basic` 不发布
