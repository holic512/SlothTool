# pzip

`pzip` 是 SlothTool 的官方 ZIP 目录压缩插件。它递归打包一个目录，保留源目录作为 ZIP 最外层目录，并默认排除 macOS 元数据、常见构建输出和 Git 元数据。

## 使用

```bash
slothtool install pzip

slothtool pzip
slothtool pzip ./my-project
pzip ./my-project --output ./releases/my-project
```

无参数默认打开全屏 TUI。带目录参数时会执行 CLI 压缩。

```text
pzip <sourceDir> [--output <archivePath>] [--exclude <pattern>]... [--dry-run] [--json]
pzip config [show]
pzip config reset
pzip config rule <ruleName> <on|off>
pzip config add <pattern>
pzip config remove <pattern>
```

默认输出写到源目录同级。例如 `pzip ./my-project` 会生成 `./my-project.zip`。若文件已存在，pzip 会创建带时间戳的新 ZIP，不覆盖旧文件。`--output` 未带 `.zip` 后缀时会自动补齐；输出路径不能位于源目录内。

## 默认过滤与 `.gitignore`

以下规则默认在任意目录深度匹配：

| 类型 | 默认排除项 |
| --- | --- |
| 文件 | `.DS_Store` |
| 目录 | `__MACOSX`、`dist`、`target`、`.git` |

其中 `target` 用于过滤 Java/Maven/Gradle 常见构建目录。pzip 会读取源目录以及所有子目录中的 `.gitignore`，并按各自所在目录解释规则、通配符和否定规则。

启用中的内置规则优先级最高，`.gitignore` 的否定规则不能重新包含它们。自定义规则只能追加排除范围，不接受以 `!` 开头的重新包含模式。

```bash
# 临时排除；不写入配置
pzip ./my-project --exclude "logs/" --exclude "*.log"

# 保存自定义排除模式
pzip config add "reports/"
pzip config add "*.local"

# 允许打包 Java target，但 .gitignore 仍可继续排除它
pzip config rule target off

# 查看或恢复默认配置
pzip config show
pzip config reset
```

配置保存到 `~/.pipker/slothtool/plugin-configs/pzip.json`。

## 结果与安全性

- ZIP 内部路径统一使用 `/`，且以源目录名为顶层目录。
- 空目录会保留在 ZIP 中。
- 符号链接不会跟随，也不会写入 ZIP；结果会提示被跳过的链接。
- `--dry-run` 只扫描、过滤和输出汇总，不创建文件。
- `--json` 输出可供脚本消费的结果，包括输出路径、大小、过滤统计和告警。
- 无效目录、不可读目录、输出路径位于源目录内，或过滤后没有可打包文件时，操作会失败且不会留下部分归档。

## 本地验证

```bash
node plugins/pzip/bin/pzip.js --help
node plugins/pzip/bin/pzip.js ./example --dry-run
SLOTHTOOL_PZIP_TUI_TEST_ACTION=exit node plugins/pzip/bin/pzip.js
node --test test/pzip-plugin.test.js
```
