# Local Build & Development Guide

## Prerequisites

- Node.js >= 22
- npm >= 10
- Git

## Install Dependencies

```bash
npm install
```

根包依赖和 `plugins/loc`、`plugins/gstore`、`plugins/todo` workspace 依赖会一起安装。

## Link SlothTool Locally

```bash
npm link
```

常用验证：

```bash
slothtool --help
slothtool
```

## Core CLI / TUI Development

关键目录：

- `bin/slothtool.js`
- `lib/commands/*`
- `lib/services/*`
- `lib/tui/*`

建议检查：

```bash
node --check bin/slothtool.js
node --check lib/tui/root-tui.js
node --check lib/services/plugin-service.js
```

## `loc` Plugin Development

本地最快的迭代方式仍然是直接运行工作区插件：

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js
node plugins/loc/bin/loc.js ./src
node plugins/loc/bin/loc.js --tui
```

## `gstore` Plugin Development

本地最快的迭代方式是直接运行工作区插件。真实 GitHub 同步需要本机安装 `git` 和 `gh`；回归测试使用本地 bare git repo，不访问 GitHub。

```bash
node plugins/gstore/bin/gstore.js --help
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
node plugins/gstore/bin/gstore.js repo status
```

## `todo` Plugin Development

本地最快的迭代方式是直接运行工作区插件。同步命令需要已安装并已绑定的 `gstore`；普通任务管理只读写临时 HOME 下的 JSON 文件。

```bash
node plugins/todo/bin/todo.js --help
SLOTHTOOL_TODO_TUI_TEST_ACTION=exit node plugins/todo/bin/todo.js
node plugins/todo/bin/todo.js add "Buy milk" --tag home --due today
node plugins/todo/bin/todo.js list --json
```

## Testing

```bash
npm test
```

额外 smoke checks：

```bash
node bin/slothtool.js --help
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
SLOTHTOOL_GSTORE_TUI_TEST_ACTION=exit node plugins/gstore/bin/gstore.js
SLOTHTOOL_TODO_TUI_TEST_ACTION=exit node plugins/todo/bin/todo.js
```

## Package Validation

```bash
npm pack --dry-run
```

插件资产模拟：

```bash
cd plugins/loc
npm pack --dry-run

cd ../gstore
npm pack --dry-run

cd ../todo
npm pack --dry-run
```

## Release Model

- 根包发布 workflow：`.github/workflows/release-core.yml`
- 官方插件发布 workflow：`.github/workflows/release-plugins.yml`
- 官方插件目录：`lib/official-plugins.json`

## Template Usage

```bash
cp -R plugins/template-basic my-plugin
cd my-plugin
node bin/mytool.js
```

`plugins/template-basic` 只是脚手架，不参与 workspace 发布或官方 Release 流程。
