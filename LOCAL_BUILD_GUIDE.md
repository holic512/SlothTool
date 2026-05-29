# Local Build & Development Guide

## Prerequisites

- Node.js >= 22
- npm >= 10
- Git

## Install Dependencies

```bash
npm install
```

根包依赖和 `plugins/loc` workspace 依赖会一起安装。

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

## Testing

```bash
npm test
```

额外 smoke checks：

```bash
node bin/slothtool.js --help
SLOTHTOOL_TUI_TEST_ACTION=exit node bin/slothtool.js
SLOTHTOOL_LOC_TUI_TEST_ACTION=exit node plugins/loc/bin/loc.js
```

## Package Validation

```bash
npm pack --dry-run
```

插件资产模拟：

```bash
cd plugins/loc
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
