# @holic512/plugin-codex-switch

Codex 配置切换插件，提供：
- Codex 配置自动发现
- models 拉取（优先远端 + 缓存回退）
- model/mode/provider 切换（自动备份 + 原子写入）
- Codex 缓存清理（仅缓存目录）
- 交互菜单（prompts）+ 清屏式 CLI 仪表盘输出

## 安装

```bash
slothtool install @holic512/plugin-codex-switch
```

## 命令

```bash
codex-switch -i
codex-switch current [--json]
codex-switch modes [--refresh] [--json]
codex-switch use
codex-switch use --mode <mode> --model <model> [--provider <id>] [--yes] [--json]
codex-switch backup list [--json]
codex-switch rollback [--id <backupId>] [--yes] [--json]
codex-switch clean cache [--dry-run] [--sessions-days <n>] [--yes] [--json]
codex-switch doctor [--json]
```

## 配置发现顺序

1. `$CODEX_HOME/config.toml`
2. Windows: `%USERPROFILE%/.codex/config.toml`
3. macOS/Linux: `~/.codex/config.toml`
4. `~/.config/codex/config.toml`

## 缓存与备份

- 插件配置：`~/.slothtool/plugin-configs/codex-switch.json`
- API 缓存：`~/.slothtool/plugin-configs/codex-switch.cache.json`
- 备份目录：`~/.slothtool/plugin-configs/codex-switch.backups/`

## 注意事项

- 使用 `@iarna/toml` 写回配置，会尽量保持字段，但不保证保留原注释与原格式顺序。
- 缓存清理仅处理：`tmp`、`shell_snapshots`，以及超期 `sessions` 子项。
- 不会删除 `config.toml`、`auth.json`、`rules/`。
