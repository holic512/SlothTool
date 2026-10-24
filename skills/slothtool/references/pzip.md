# pzip：先预览，再 ZIP

“打包”先区分目标：目录 ZIP 用 pzip；编译、测试或生成可部署 build 使用项目自己的构建流程；官方插件离线 `.tgz` 用根 `bundle`。pzip 不执行编译。若要求包含构建产物，先确认已完成构建及过滤配置是否会排除产物。

## 安全流程

1. 查看 `slothtool pzip config show`。保留现有内置开关、自定义排除项及目录树中的 `.gitignore`；不要改用户文件来绕过过滤。
2. 选择源目录之外的输出 ZIP；其父目录必须已存在，必要时只创建任务授权的输出目录。保留用户指定的额外排除项，引用通配符，防止 shell 展开。
3. 用目标输出与过滤参数先 `--dry-run --json`，检查统计、排除原因和警告是否符合任务。
4. 在预览符合用户目标后，使用相同源目录、输出与排除参数，**只去掉 `--dry-run`** 生成 ZIP。授权明确且预览无冲突时可继续，不必为了两阶段额外打断。

以下例子把 `./my-app` 归档到其外侧；`logs/`、`*.log` 仅是示例，实际应保留用户的规则：

```sh
slothtool pzip config show
slothtool pzip ./my-app --output ./my-app.zip --exclude 'logs/' --exclude '*.log' --dry-run --json
slothtool pzip ./my-app --output ./my-app.zip --exclude 'logs/' --exclude '*.log' --json
```

预览给出计数、字节、排除汇总与警告，不是逐文件清单。默认内置规则排除 `.DS_Store`、`__MACOSX`、`dist`、`target`、`.git`；用户可已有不同配置。嵌套 `.gitignore` 参与过滤；自定义/命令行排除不可用 `!` 反选。这些默认过滤不等于敏感信息审计，也不保证排除 `.env`、密钥或业务数据；对外分发前按用户要求检查实际内容范围，不能宣称压缩包已脱敏。符号链接和特殊文件会跳过，不要宣称归档完全复制了所有文件。

已存在的 ZIP 不被覆盖，会选择带时间戳的可用文件名；实际生成路径可能不同于预览路径，以最终 JSON 的 `archivePath` 为准，并确认实际文件存在及警告。不要把 `dryRun: true` 当成已产出 ZIP。

## 有授权才调整持久化规则

```sh
slothtool pzip config rule target off
slothtool pzip config add 'reports/'
slothtool pzip config remove 'reports/'
```

`config rule` 仅支持上述五个内置规则。不要为一次压缩执行 `config reset` 或关闭用户筛选；若必须包括 `dist`/`target` 而现有配置排除它们，先说明冲突并取得变更授权。

源码核对位置：`plugins/pzip/bin/pzip.js`、`plugins/pzip/lib/{service,config,filter}.js`。
