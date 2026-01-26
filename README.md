# SlothTool

🐌 一个轻量级的 CLI 工具插件管理器

SlothTool 是一个插件管理系统，允许你安装、管理和运行 CLI 工具作为插件，而不会污染全局 npm 环境。

## 特性

- **零全局污染**：插件安装在 `~/.slothtool/plugins/`，不会污染全局 npm
- **简单命令**：直观易用的 CLI 命令
- **插件隔离**：每个插件都有自己的依赖
- **简写语法**：使用 `slothtool <plugin>` 代替 `slothtool run <plugin>`
- **Monorepo 结构**：官方插件在同一仓库中维护
- **独立发布**：每个插件可以独立发布
- **双语支持**：支持中文和英文界面（默认中文）
- **交互式界面**：核心工具和插件都提供菜单驱动的交互式体验
- **官方插件库**：内置官方插件配置，一键安装

## 安装

```bash
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

- 📦 安装插件（官方插件 / 自定义插件）
- 🗑️ 卸载插件
- 📋 查看已安装的插件
- ▶️ 运行插件
- 🌐 配置语言

### 配置语言

```bash
# 设置为中文（默认）
slothtool config language zh

# 设置为英文
slothtool config language en

# 查看当前语言
slothtool config
```

### 安装插件

```bash
# 方式1：直接安装
slothtool install @holic512/plugin-loc

# 方式2：交互式安装（推荐）
slothtool -i
# 然后选择 "安装插件" -> "安装官方插件"
```

### 列出已安装的插件

```bash
slothtool list
```

### 运行插件

```bash
# 完整语法
slothtool run loc ./src

# 简写语法（推荐）
slothtool loc ./src
```

### 卸载插件

```bash
slothtool uninstall loc
```

### 获取帮助

```bash
slothtool --help
```

## 官方插件

### @holic512/plugin-loc

统计目录中的代码行数，支持交互式模式和文件类型过滤。

```bash
# 安装插件
slothtool install @holic512/plugin-loc

# 基本使用
slothtool loc ./src

# 详细模式（显示每个文件的行数）
slothtool loc -v ./src

# 交互式模式（菜单驱动）
slothtool loc -i

# 配置文件类型过滤
slothtool loc -c
```

## 添加新的官方插件

如果你开发了新的插件，可以将其添加到官方插件列表：

1. 编辑 `packages/slothtool/lib/official-plugins.json`
2. 添加插件信息：

```json
{
  "officialPlugins": [
    {
      "name": "@holic512/plugin-loc",
      "alias": "loc",
      "description": "统计目录中的代码行数",
      "descriptionEn": "Count lines of code in a directory",
      "version": "latest",
      "author": "holic512",
      "features": [
        "代码行数统计",
        "文件类型过滤",
        "交互式模式",
        "详细模式"
      ],
      "featuresEn": [
        "Line counting",
        "File type filtering",
        "Interactive mode",
        "Verbose mode"
      ]
    },
    {
      "name": "@holic512/plugin-your-new-plugin",
      "alias": "your-plugin",
      "description": "你的插件描述",
      "descriptionEn": "Your plugin description",
      "version": "latest",
      "author": "holic512",
      "features": [
        "功能1",
        "功能2"
      ],
      "featuresEn": [
        "Feature 1",
        "Feature 2"
      ]
    }
  ]
}
```

3. 用户在交互式模式中就能看到并安装你的新插件了！

## 本地开发指南

### 前置知识

与 Vue 项目的 `npm run dev` 不同，SlothTool 是一个 **CLI 工具**，不是 Web 应用。理解以下概念：

1. **CLI 工具**：在终端运行的命令行程序（如 `git`、`npm`）
2. **npm link**：将本地开发的包链接到全局，让你可以像安装的包一样使用它
3. **Monorepo**：一个仓库包含多个包（slothtool 核心 + 多个插件）

### 项目结构

```
SlothTool/
├── packages/
│   ├── slothtool/          # 核心 CLI 工具
│   │   ├── bin/            # 可执行文件入口
│   │   │   └── slothtool.js
│   │   ├── lib/            # 核心逻辑
│   │   │   ├── commands/   # 命令实现
│   │   │   ├── i18n.js     # 国际化
│   │   │   ├── settings.js # 设置管理
│   │   │   ├── registry.js # 插件注册表
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── plugin-loc/         # LOC 插件（示例）
│       ├── bin/            # 插件入口
│       │   └── loc.js
│       ├── lib/            # 插件逻辑
│       │   ├── counter.js  # 代码统计
│       │   ├── config.js   # 插件配置
│       │   └── i18n.js     # 插件国际化
│       └── package.json
│
├── package.json            # 根 package.json（workspaces 配置）
└── README.md
```

### 第一步：克隆并安装依赖

```bash
# 克隆仓库
git clone https://github.com/yourusername/SlothTool.git
cd SlothTool

# 安装所有依赖（会自动安装所有 workspace 的依赖）
npm install
```

**发生了什么？**

- npm 会读取根目录的 `package.json`，发现 `workspaces: ["packages/*"]`
- 自动安装 `packages/slothtool` 和 `packages/plugin-loc` 的依赖
- 在 `node_modules` 中创建软链接，让各个包可以互相引用

### 第二步：链接 slothtool 到全局

```bash
cd packages/slothtool
npm link
cd ../..
```

**发生了什么？**

- `npm link` 在全局 npm 目录创建一个符号链接，指向你的本地代码
- 现在你在终端输入 `slothtool`，实际运行的是你本地的 `packages/slothtool/bin/slothtool.js`
- **这就是"本地运行"的关键**：你修改代码后，直接运行 `slothtool` 就能看到效果

### 第三步：测试 slothtool 核心功能

```bash
# 测试帮助命令
slothtool --help

# 测试语言配置
slothtool config language zh
slothtool config language en

# 查看已安装的插件（此时应该是空的）
slothtool list
```

**调试技巧**：

- 如果修改了 `packages/slothtool/lib/` 下的任何文件，直接运行 `slothtool` 就能看到效果
- 如果修改了 `bin/slothtool.js`，也是立即生效
- **不需要重新 build 或 restart**，因为 Node.js 每次运行都会重新读取文件

### 第四步：本地开发和测试插件

#### 方式一：使用 npm link（推荐用于开发）

```bash
# 链接插件到全局
cd packages/plugin-loc
npm link
cd ../..

# 现在可以直接运行插件（不通过 slothtool）
loc --help
loc ./src
loc -i

# 或者通过 slothtool 安装本地链接的插件
slothtool install @holic512/plugin-loc
slothtool loc ./src
```

**发生了什么？**

- `npm link` 让 `loc` 命令全局可用
- 你修改 `packages/plugin-loc/` 下的代码后，直接运行 `loc` 或 `slothtool loc` 就能看到效果

#### 方式二：直接运行插件文件（快速测试）

```bash
# 直接运行插件的 bin 文件
node packages/plugin-loc/bin/loc.js --help
node packages/plugin-loc/bin/loc.js ./src
node packages/plugin-loc/bin/loc.js -i
```

**适用场景**：

- 快速测试单个功能
- 不想污染全局命令
- 调试时添加 `console.log`

### 第五步：开发工作流

#### 修改 slothtool 核心代码

```bash
# 1. 编辑文件
vim packages/slothtool/lib/i18n.js

# 2. 直接测试（无需重启或 build）
slothtool --help

# 3. 如果有语法错误，会立即看到错误信息
```

#### 修改插件代码

```bash
# 1. 编辑插件文件
vim packages/plugin-loc/lib/counter.js

# 2. 直接测试
slothtool loc ./src

# 或者
node packages/plugin-loc/bin/loc.js ./src
```

#### 添加新功能

假设你要给 slothtool 添加一个新命令 `update`：

```bash
# 1. 创建命令文件
vim packages/slothtool/lib/commands/update.js

# 2. 在 commands/index.js 中导出
vim packages/slothtool/lib/commands/index.js

# 3. 在 bin/slothtool.js 中添加命令处理
vim packages/slothtool/bin/slothtool.js

# 4. 测试
slothtool update
```

### 第六步：调试技巧

#### 使用 console.log 调试

```javascript
// packages/slothtool/lib/plugin-manager.js
function installPlugin(packageName) {
    console.log('DEBUG: packageName =', packageName);
    const alias = extractPluginAlias(packageName);
    console.log('DEBUG: alias =', alias);
    // ...
}
```

然后运行：

```bash
slothtool install @holic512/plugin-loc
```

#### 使用 Node.js 调试器

```bash
# 使用 Node.js 内置调试器
node inspect packages/slothtool/bin/slothtool.js install @holic512/plugin-loc

# 或者使用 VS Code 调试
# 在 .vscode/launch.json 中配置：
{
  "type": "node",
  "request": "launch",
  "name": "Debug slothtool",
  "program": "${workspaceFolder}/packages/slothtool/bin/slothtool.js",
  "args": ["install", "@holic512/plugin-loc"]
}
```

### 第七步：测试完整流程

```bash
# 1. 确保 slothtool 已链接
cd packages/slothtool
npm link
cd ../..

# 2. 测试安装插件（从 npm）
slothtool install @holic512/plugin-loc

# 3. 测试运行插件
slothtool loc ./packages

# 4. 测试交互式模式
slothtool loc -i

# 5. 测试配置
slothtool loc -c

# 6. 测试卸载
slothtool uninstall loc

# 7. 测试语言切换
slothtool config language en
slothtool --help
slothtool config language zh
slothtool --help
```

### 常见问题

#### Q: 修改代码后没有生效？

A: 检查以下几点：

1. 确保使用了 `npm link`
2. 确保没有语法错误（检查终端输出）
3. 如果修改了 `package.json`，可能需要重新 `npm link`
4. 清除缓存：`rm -rf ~/.slothtool` 然后重新测试

#### Q: 如何查看 slothtool 安装的插件？

A: 插件安装在用户目录：

```bash
# 查看插件目录
ls -la ~/.slothtool/plugins/

# 查看注册表
cat ~/.slothtool/registry.json

# 查看设置
cat ~/.slothtool/settings.json

# 查看插件配置
cat ~/.slothtool/plugin-configs/loc.json
```

#### Q: 如何重置所有配置？

A: 删除 slothtool 目录：

```bash
rm -rf ~/.slothtool
```

#### Q: npm link 和 npm install 的区别？

A:

- `npm link`：创建符号链接，指向本地代码，修改立即生效（用于开发）
- `npm install`：从 npm 仓库下载并安装包（用于生产）

#### Q: 为什么不需要 build 或 compile？

A: 因为这是纯 JavaScript 项目，Node.js 直接执行 `.js` 文件，不需要编译。如果你使用 TypeScript，则需要编译步骤。

### 发布到 npm

当你完成开发并准备发布时：

```bash
# 1. 发布 slothtool 核心
cd packages/slothtool
npm version patch  # 或 minor, major
npm publish --access public

# 2. 发布插件
cd ../plugin-loc
npm version patch
npm publish --access public
```

## 创建自己的插件

### 插件结构

```
my-plugin/
├── package.json
├── bin/
│   └── my-tool.js
└── lib/
    └── index.js
```

### package.json

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "bin": {
    "mytool": "bin/my-tool.js"
  }
}
```

### bin/my-tool.js

```javascript
#!/usr/bin/env node

console.log('Hello from my plugin!');
```

### 发布插件

```bash
npm publish --access public
```

### 用户使用

```bash
slothtool install @yourscope/plugin-mytool
slothtool mytool
```

## 架构说明

### 核心组件

- **slothtool**：核心 CLI 工具，管理插件
- **插件**：独立的 npm 包，包含 CLI 可执行文件
- **注册表**：本地 JSON 文件（`~/.slothtool/registry.json`）跟踪已安装的插件
- **插件存储**：`~/.slothtool/plugins/` 目录包含插件安装
- **设置**：`~/.slothtool/settings.json` 存储全局设置（如语言）
- **插件配置**：`~/.slothtool/plugin-configs/` 存储插件特定配置

### 工作原理

1. **安装插件**：使用 `npm install --prefix` 将插件安装到隔离目录
2. **运行插件**：从注册表查找插件的 bin 路径，使用 `spawn` 运行
3. **语言支持**：所有组件读取 `settings.json` 获取当前语言
4. **插件配置**：插件可以在 `plugin-configs/` 存储自己的配置

## 许可证

ISC

## 贡献

欢迎贡献！请随时提交 Pull Request。
