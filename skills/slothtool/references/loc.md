# loc：文本行统计

```sh
slothtool loc config show
slothtool loc ./src
slothtool loc -v ./src
```

必须传目录或显式配置子命令；`-v` 为逐文件结果。使用现有扩展名开关和排除目录配置，不假设扫描所有文件，也不假设使用 `.gitignore`。

统计口径是 UTF-8 文本按 `content.split('\n').length` 计数，**包含空行和注释**，不是有效代码行/SLOC。空文件也计 1 行，末尾换行会增加一个空段。报告目录、过滤范围、文件数、文本行数和警告；读取失败会跳过并产生警告，不应称结果完整无遗漏。当前命令没有 `--json`、临时 `--exclude` 或“排除注释”参数。

仅在用户要求调整持久化配置时使用以下例子；不要通过 reset 强行扩大统计范围：

```sh
slothtool loc config ext md off
slothtool loc config ext ts on
slothtool loc config exclude node_modules on
```

扩展名不带点；`ext <name> on|off` 控制是否统计，`exclude <name> on|off` 控制是否排除。若用户只要临时不同口径，先说明现有命令的持久化影响，征求允许或采用用户认可的替代统计方式，不静默改配置。

源码核对位置：`plugins/loc/bin/loc.js`、`plugins/loc/lib/{service,counter,config}.js`。
