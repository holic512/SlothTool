# Local Build & Development Guide

## Prerequisites

- Node.js >= 22
- npm >= 10
- Git

## Install Dependencies

```bash
npm install
```

根包依赖和 `plugins/loc`、`plugins/gstore`、`plugins/pzip`、`plugins/slothvault` workspace 依赖会一起安装。

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

## `pzip` Plugin Development

`pzip` 只依赖 Node 运行时包，不调用系统 `zip` 命令；测试会直接验证生成 ZIP 的条目。

```bash
node plugins/pzip/bin/pzip.js --help
node plugins/pzip/bin/pzip.js ./example --dry-run
SLOTHTOOL_PZIP_TUI_TEST_ACTION=exit node plugins/pzip/bin/pzip.js
node --test test/pzip-plugin.test.js
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
SLOTHTOOL_PZIP_TUI_TEST_ACTION=exit node plugins/pzip/bin/pzip.js
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

cd ../pzip
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

## SlothVault standalone helper synchronization

修改根目录的 Release、网络、SlothVault 路径或本地清理工具后，同步插件内的副本；独立打包不能依赖根安装目录。

```bash
npm run sync:slothvault-helpers
npm run check:slothvault-helpers
node --test test/slothvault-components.test.js test/slothvault-storage.test.js test/slothvault-manager-tui.test.js
npm pack --dry-run --workspace @holic512/plugin-slothvault
```

SlothVault 界面可直接进入总览，无需 Python 或外部组件；只有部署执行需要 Deployment 包及 Python 3.10+；Skill 不需要 Python，MCP 连接使用智能体原生配置。测试使用隔离 HOME 与本地 Release／桥协议夹具，不安装或清理真实用户数据。
