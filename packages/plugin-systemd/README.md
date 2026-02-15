# @holic512/plugin-systemd

Interactive systemd service management tool for SlothTool.

SlothTool 的 systemd 服务管理插件，提供交互式操作与命令行支持。

## Install / 安装

```bash
slothtool install @holic512/plugin-systemd
```

## Usage / 使用

### Interactive mode / 交互式模式

```bash
slothtool systemd -i
```

### Command mode / 命令模式

```bash
# List services
slothtool systemd list --state active
slothtool systemd list --all

# Service actions
slothtool systemd start ssh.service
slothtool systemd stop ssh.service
slothtool systemd restart ssh.service
slothtool systemd enable ssh.service
slothtool systemd disable ssh.service

# Logs
slothtool systemd logs ssh.service --lines 50
slothtool systemd logs ssh.service --follow
slothtool systemd logs ssh.service --since "1 hour ago"
```

## Features / 功能

- Interactive-first UX with history-based quick actions
- Service management: start/stop/restart/enable/disable/status
- Logs with line limit, follow, and since filters
- History cache for recent services/actions/searches
- Bilingual (Chinese/English) messages

- 交互式优先，支持历史记录快捷操作
- 服务管理：启动/停止/重启/启用/禁用/状态
- 日志查看：行数限制、持续跟随、时间过滤
- 历史缓存：最近服务/操作/搜索记录
- 中英文双语支持

## Troubleshooting / 常见问题

### Permission denied / 权限不足

Some actions require root permission. The plugin does not auto-sudo. Copy the suggestion it prints, for example:

```bash
sudo systemctl restart nginx.service
```

部分操作需要 root 权限。插件不会自动提权，请复制提示的 sudo 命令执行。

### systemctl not found / 找不到 systemctl

Ensure you are running on a Linux system with systemd installed and running.

请确认运行环境为 Linux 且已安装并启用 systemd。
