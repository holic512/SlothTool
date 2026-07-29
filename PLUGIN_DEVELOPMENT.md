# Plugin Development Guide

本仓库当前保留五个官方插件工作区 `plugins/loc`、`plugins/image-compress`、`plugins/gstore`、`plugins/todo`、`plugins/codex-models`，以及一个脚手架目录 `plugins/template-basic`。

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


## Offline Archive Contract

SlothTool 只允许对 `lib/official-plugins.json` 中的官方 alias 执行离线安装和打包：

```bash
slothtool install <alias> --file ./plugin-offline.tgz
slothtool bundle <alias> --output ./plugin-offline.tgz
```

离线归档约束：

1. 归档解包后必须使用 npm pack 风格的 `package/` 根目录，或能够由发布资产解析器定位到唯一插件根目录。
2. `package/package.json` 的 `name` 必须与该官方 alias 声明的 `packageName` 完全一致；仅修改包名不能安装任意第三方插件。
3. 真正自包含的离线归档必须带有生产运行时所需的 `node_modules`。
4. 如果归档声明了运行时依赖但不含 `node_modules`，安装器只会执行 `npm install --omit=dev --offline`；npm 缓存不足时安装失败，不会隐式联网。
5. `slothtool bundle` 只从已安装插件生成归档；若依赖不完整会拒绝打包，避免生成表面可安装但无法离线运行的资产。
6. 安装成功后 registry 的 `sourceType` 记录为 `offline-archive`。

对于纯 Node 官方插件，推荐先在联网构建机安装完整生产依赖，再执行 `slothtool bundle`，把归档复制到目标离线环境。

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

优先参考 `plugins/loc`、`plugins/image-compress`、`plugins/gstore`、`plugins/todo` 或 `plugins/codex-models` 来实现：

- 默认 TUI 入口
- 显式 CLI 统计/配置命令
- 插件配置落盘
- 双语输出

`gstore` 是需要 CLI + TUI 但核心逻辑仍独立于 Ink 的参考实现；其本地 Git 工作区固定为 `~/.slothtool/data`。

`todo` 是需要拆分 JSON 数据文件、完整 CLI 和手动同步桥接的参考实现；它通过 `gstore` 命令同步 `~/.slothtool/data/todo/default`。

`codex-models` 是“service 负责配置解析、provider 请求、模型元数据和安全脚本生成，Ink 只负责渲染与确认流程”的参考实现；其模型库演示了 provider 显式元数据、已核验画像、厂商兼容画像和保守 fallback 的分层合并。

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

`todo` 参考命令：

```bash
node plugins/todo/bin/todo.js --help
SLOTHTOOL_TODO_TUI_TEST_ACTION=exit node plugins/todo/bin/todo.js
node plugins/todo/bin/todo.js add "Buy milk" --tag home
node plugins/todo/bin/todo.js list
```

`codex-models` 参考命令：

```bash
node plugins/codex-models/bin/codex-models.js --help
SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION=exit node plugins/codex-models/bin/codex-models.js
node plugins/codex-models/bin/codex-models.js library list
node --test test/codex-models-cli.test.js
```

## Integration Notes

SlothTool 当前只安装内置官方插件：

- `slothtool install loc`、`slothtool install image-compress`、`slothtool install gstore`、`slothtool install todo`、`slothtool install codex-models` 可用，因为它们定义在 `lib/official-plugins.json`
- 相同 alias 可通过 `slothtool install <alias> --file <archive.tgz>` 离线安装，但归档包名仍必须与官方目录一致
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
- `todo` 任务目录：`~/.slothtool/data/todo/default/tasks/<yyyy>/<mm>/<uuid>.json`

## Publishing Model

- 根包 `@holic512/slothtool` 从仓库根目录发布
- 官方纯 Node 插件 `@holic512/plugin-loc`、`@holic512/plugin-gstore`、`@holic512/plugin-todo`、`@holic512/plugin-codex-models` 通过 `npm pack` 生成 GitHub Release 资产
- `@holic512/plugin-image-compress` 使用专用多平台 release workflow
- `plugins/template-basic` 不发布
