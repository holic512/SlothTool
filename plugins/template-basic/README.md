# template-basic

这是 SlothTool 的默认插件脚手架目录。

## Goals

- 演示“默认 TUI + 显式 CLI”插件结构
- 演示统一的插件 tab 头部与状态栏外壳
- 提供最小可运行的 Ink 全屏页面
- 给新插件提供 `slothtool.ui` 元数据样板

## Usage

```bash
cp -R plugins/template-basic my-plugin
cd my-plugin
node bin/mytool.js
```

## What To Update

- `package.json`
- `bin/mytool.js`
- `lib/i18n.js`
- `lib/config.js`
- `lib/interactive.js`

## Notes

- 脚手架采用 ESM。
- 无参数默认进入 TUI。
- `hello` 和 `config` 作为最小 CLI 子命令示例保留。
- 该目录不是 workspace 发布包，也不参与官方 Release 自动化。
