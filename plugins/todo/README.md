# @holic512/plugin-todo

`todo` 是基于独立 JSON 文件的 TodoList 插件。它默认启动全屏 TUI，也提供完整 CLI；数据写入 `~/.slothtool/data/todo/default/`，可以通过 `gstore` 手动同步到 GitHub private repo。

## Installation

```bash
slothtool install todo
slothtool install gstore
```

## Usage

```bash
# 默认进入 TUI
slothtool todo
todo

# CLI 任务管理
todo add "Buy milk" --tag home --due today
todo list --due today
todo show <id-prefix>
todo edit <id-prefix> --priority high --project personal
todo done <id-prefix>
todo delete <id-prefix>
todo purge <id-prefix>

# checklist / note
todo checklist add <task> "Prepare receipt"
todo note add <task> "Remember to use coupon"

# 手动同步
gstore bind todo default ~/.slothtool/data/todo/default
todo sync
todo conflicts --json
```

## Data Layout

```text
~/.slothtool/data/
├── plugin-configs/
│   └── todo.json
└── todo/
    └── default/
        ├── lists/
        │   └── default.json
        └── tasks/
            └── <yyyy>/<mm>/<uuid>.json
```

每条任务都是单独 JSON 文件，便于 Git 文件级同步和冲突定位。`todo` 不保存 GitHub token，也不实现 Git 协议；同步相关命令只委托给 `gstore`。
