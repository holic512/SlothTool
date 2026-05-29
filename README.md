# SlothTool

🐌 一个轻量级 CLI 插件管理器。

SlothTool 本体通过 npm 分发，官方插件通过 GitHub Release 源码包分发。当前仓库只保留一个官方插件：`loc`。

## 特性

- 零全局污染：插件安装到 `~/.slothtool/plugins/`
- 官方插件直装：`slothtool install loc`
- 插件隔离：每个插件有自己的依赖目录
- 双语支持：中文 / English
- 交互式模式：`slothtool -i`
- GitHub Release 更新：官方插件从 Release 资产安装和更新

## 安装

```bash
npm install -g @holic512/slothtool
```

验证安装：

```bash
slothtool --help
```

## 快速开始

```bash
# 安装唯一官方插件
slothtool install loc

# 运行插件
slothtool loc .

# 交互式模式
slothtool -i
```

## 常用命令

```bash
slothtool install loc
slothtool update loc
slothtool --update-all
slothtool uninstall loc
slothtool list
slothtool config language zh
slothtool config language en
slothtool --uninstall-all
```

`slothtool list` 输出示例：

```text
已安装的插件：

  loc
    Package: @holic512/plugin-loc
    Version: 1.0.3
    Source: GitHub Release
    Installed: 2026/05/30 10:30:00
```

## 官方插件

### `loc`

统计目录中的代码行数，支持详细模式、交互模式和文件类型过滤。

安装：

```bash
slothtool install loc
```

使用：

```bash
slothtool loc .
slothtool loc ./src
slothtool loc -v ./src
slothtool loc -i
slothtool loc -c
```

## 工作原理

1. `slothtool install loc` 读取内置官方插件清单。
2. SlothTool 从 GitHub Release 下载 `loc` 的 `.tgz` 源码包。
3. 解压到 `~/.slothtool/plugins/loc/` 后，本地安装生产依赖。
4. 把插件入口和来源信息写入 `~/.slothtool/registry.json`。
5. 运行 `slothtool loc ...` 时，从注册表读取入口并启动插件。

## 配置目录

```text
~/.slothtool/
├── settings.json
├── registry.json
├── plugins/
│   └── loc/
└── plugin-configs/
    └── loc.json
```

## 仓库结构

```text
SlothTool/
├── bin/                     # SlothTool CLI 入口
├── lib/                     # SlothTool 核心逻辑
├── plugins/
│   ├── loc/                 # 唯一官方插件
│   └── template-basic/      # 非发布脚手架模板
├── README.md
├── PLUGIN_DEVELOPMENT.md
├── LOCAL_BUILD_GUIDE.md
└── package.json
```

## 开发说明

- SlothTool 根目录就是 `@holic512/slothtool` 包。
- `plugins/loc` 是唯一 workspace 插件包。
- `plugins/template-basic` 只是脚手架，不参与发布。
- 本地开发 `loc` 时，优先直接运行：

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
```

## 文档

- [插件开发手册](./PLUGIN_DEVELOPMENT.md)
- [本地构建指南](./LOCAL_BUILD_GUIDE.md)

## 许可证

ISC
