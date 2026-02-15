# SlothTool

🐌 一个轻量级的 CLI 工具插件管理器

SlothTool 是一个插件管理系统，允许你安装、管理和运行 CLI 工具作为插件，而不会污染全局 npm 环境。

## 特性

- **零全局污染**：插件安装在 `~/.slothtool/plugins/`，不会污染全局 npm
- **简单命令**：直观易用的 CLI 命令
- **插件隔离**：每个插件都有自己的依赖
- **简写语法**：使用 `slothtool <plugin>` 代替 `slothtool run <plugin>`
- **双语支持**：支持中文和英文界面（默认中文）
- **交互式界面**：提供菜单驱动的交互式体验
- **插件更新**：支持单个或批量更新插件
- **官方插件库**：内置官方插件配置，一键安装

## 快速开始

### 安装

```bash
npm install -g @holic512/slothtool
```

### 基本使用

```bash
# 交互式模式（推荐新手使用）
slothtool -i

# 安装插件
slothtool install @holic512/plugin-loc

# 运行插件
slothtool loc ./src

# 查看帮助
slothtool --help
```

## 目录

- [安装](#安装-1)
- [使用方法](#使用方法)
  - [交互式模式](#交互式模式推荐)
  - [命令行模式](#命令行模式)
- [官方插件](#官方插件)
- [配置](#配置)
- [文档](#文档)
- [贡献](#贡献)
- [许可证](#许可证)

## 安装

### 全局安装（推荐）

```bash
npm install -g @holic512/slothtool
```

### 验证安装

```bash
slothtool --help
```

### Debian 一键安装（Node.js 20 LTS + SlothTool）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g @holic512/slothtool
```

## 使用方法

### 🎯 交互式模式（推荐）

最简单的使用方式，提供友好的菜单界面：

```bash
slothtool -i
# 或
slothtool --interactive
```

**交互式模式功能：**

- 📦 **安装插件**
  - 安装官方插件（从预配置列表选择）
  - 安装自定义插件（输入包名）
- 🗑️ **卸载插件**
- 🔄 **更新插件**
  - 更新单个插件
  - 一键更新所有插件
- 📋 **查看已安装的插件**
- ▶️ **运行插件**
  - 自动检测插件是否支持交互式模式
  - 智能启动插件（交互式或参数模式）
- 🌐 **配置语言**
- 🗑️ **完全卸载 SlothTool**

### 命令行模式

#### 安装插件

```bash
# 安装官方插件
slothtool install @holic512/plugin-loc

# 安装任何 npm 包作为插件
slothtool install <package-name>
```

#### 列出已安装的插件

```bash
slothtool list
```

输出示例：
```
已安装的插件：

  loc
    Package: @holic512/plugin-loc
    Version: 1.0.1
    Installed: 2024-01-26 10:30:00
```

#### 运行插件

```bash
# 完整语法
slothtool run loc ./src

# 简写语法（推荐）
slothtool loc ./src

# 传递参数给插件
slothtool loc -v ./src
slothtool loc --help
```

#### 更新插件

```bash
# 更新单个插件
slothtool update loc

# 更新所有插件
slothtool --update-all
```

#### 卸载插件

```bash
slothtool uninstall loc
```

#### 完全卸载 SlothTool

```bash
# 删除所有插件和配置数据
slothtool --uninstall-all

# 然后卸载 SlothTool 本身
npm uninstall -g @holic512/slothtool
```

#### 获取帮助

```bash
slothtool --help
slothtool -h
```

## 官方插件

### @holic512/plugin-loc

统计目录中的代码行数，支持交互式模式和文件类型过滤。

**安装：**

```bash
slothtool install @holic512/plugin-loc
```

**使用：**

```bash
# 显示帮助
slothtool loc

# 统计当前目录
slothtool loc .

# 统计指定目录
slothtool loc ./src

# 详细模式（显示每个文件的行数）
slothtool loc -v ./src

# 交互式模式（菜单驱动）
slothtool loc -i

# 配置文件类型过滤
slothtool loc -c
```

**功能特性：**

- 代码行数统计
- 文件类型过滤（可配置）
- 排除目录配置（node_modules 等）
- 交互式菜单界面
- 详细模式显示每个文件
- 支持中英文界面

### @holic512/plugin-llm-base

LLM 基础能力层，提供 profile 配置管理、OpenAI 协议兼容调用、调用日志能力。

**安装：**

```bash
slothtool install @holic512/plugin-llm-base
```

**使用：**

```bash
# 查看帮助
slothtool llm-base --help

# 交互式配置
slothtool llm-base -i

# 创建 profile
slothtool llm-base config create local

# 查看配置（脱敏）
slothtool llm-base config export

# low/high 模式调用
slothtool llm-base chat "你好" --mode low
slothtool llm-base chat "请详细分析" --mode high
```

**功能特性：**

- 多 profile 配置管理
- low/high 双模型切换
- OpenAI Chat Completions 兼容
- 统一返回结构与错误码
- 调用日志（最近 500 条）
- 默认安全脱敏

## 配置

### 语言设置

SlothTool 支持中文和英文界面。

```bash
# 设置为中文（默认）
slothtool config language zh

# 设置为英文
slothtool config language en

# 查看当前语言
slothtool config
```

语言设置会影响：
- SlothTool 核心界面
- 所有支持 i18n 的插件界面

### 配置文件位置

SlothTool 的配置和数据存储在用户目录：

```
~/.slothtool/
├── settings.json           # 全局设置（语言等）
├── registry.json           # 已安装插件的注册表
├── plugins/                # 插件安装目录
│   ├── loc/
│   │   └── node_modules/
│   └── ...
└── plugin-configs/         # 插件配置文件
    ├── loc.json
    └── ...
```

## 文档

### 📚 用户文档

- [README.md](./README.md)（本文档）- 安装和使用指南

### 🔧 开发者文档

- [插件开发手册](./PLUGIN_DEVELOPMENT.md) - 学习如何创建 SlothTool 插件
- [本地构建指南](./LOCAL_BUILD_GUIDE.md) - 为 SlothTool 项目贡献代码

## 常见问题

### 如何查看已安装的插件？

```bash
slothtool list
```

### 如何更新插件？

```bash
# 更新单个插件
slothtool update <plugin-alias>

# 更新所有插件
slothtool --update-all
```

### 插件安装在哪里？

插件安装在 `~/.slothtool/plugins/` 目录下，每个插件都有独立的目录和依赖。

### 如何重置所有配置？

```bash
# 删除所有 SlothTool 数据
rm -rf ~/.slothtool

# 或使用命令
slothtool --uninstall-all
```

### 插件运行出错怎么办？

1. 检查插件是否正确安装：`slothtool list`
2. 尝试重新安装：`slothtool uninstall <plugin>` 然后 `slothtool install <plugin>`
3. 查看插件帮助：`slothtool <plugin> --help`
4. 检查 SlothTool 数据：`cat ~/.slothtool/registry.json`

### 如何创建自己的插件？

请参阅 [插件开发手册](./PLUGIN_DEVELOPMENT.md)。

## 架构说明

### 核心组件

- **slothtool**：核心 CLI 工具，管理插件生命周期
- **插件**：独立的 npm 包，包含 CLI 可执行文件
- **注册表**：本地 JSON 文件跟踪已安装的插件
- **插件存储**：隔离的目录存储每个插件及其依赖
- **设置**：全局配置（语言等）
- **插件配置**：插件特定的配置文件

### 工作原理

1. **安装插件**：使用 `npm install --prefix` 将插件安装到隔离目录
2. **运行插件**：从注册表查找插件的 bin 路径，使用 `spawn` 运行
3. **语言支持**：所有组件读取 `settings.json` 获取当前语言
4. **插件配置**：插件可以在 `plugin-configs/` 存储自己的配置

### 插件开发规范

插件可以通过在 `package.json` 中添加 `slothtool` 字段来声明特性：

```json
{
  "slothtool": {
    "interactive": true,
    "interactiveFlag": "-i"
  }
}
```

这样 SlothTool 就能自动检测并启动插件的交互式模式。

详细信息请参阅 [插件开发手册](./PLUGIN_DEVELOPMENT.md)。

## 贡献

欢迎贡献！无论是报告 bug、提出新功能建议，还是提交代码。

### 如何贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m "feat: add my feature"`
4. 推送到分支：`git push origin feature/my-feature`
5. 创建 Pull Request

### 开发指南

如果你想为 SlothTool 核心或插件贡献代码，请参阅：

- [本地构建指南](./LOCAL_BUILD_GUIDE.md) - 设置开发环境
- [插件开发手册](./PLUGIN_DEVELOPMENT.md) - 创建插件

### 行为准则

- 尊重他人
- 提供建设性反馈
- 保持友好和专业

## 许可证

ISC

## 链接

- [GitHub 仓库](https://github.com/yourusername/SlothTool)
- [npm 包](https://www.npmjs.com/package/@holic512/slothtool)
- [问题反馈](https://github.com/yourusername/SlothTool/issues)

## 致谢

感谢所有贡献者和使用 SlothTool 的用户！

---

Made with 🐌 by the SlothTool team
