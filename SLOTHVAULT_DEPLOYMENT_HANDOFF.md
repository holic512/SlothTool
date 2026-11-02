# SlothVault 独立部署交接

SlothTool 2.12.0 与 SlothVault 插件 3.3.0 只管理 Skill。Deployment 包下载、更新、Python 执行器和 JSON 行桥已移除；旧命令返回 `SLOTHVAULT_DEPLOYMENT_REMOVED` 及独立入口提示。普通插件升级不清理旧部署包。

部署源码由同级 SlothVault 仓库的 `integrations/deployment/` 维护，继续独立发布 `deployment-vX.Y.Z`、`slothvault-deployment-X.Y.Z.tgz` 和 SHA-256 清单。下载、校验并解压完整归档后运行 `python3 menu.py`；菜单只使用 Python 标准库和数字选择。

各操作分别运行 `install.py`、`check_update.py`、`update.py`、`start.py`、`stop.py`、`restart.py`、`status.py`。全部支持 `--root`、`--help`、`--version`，默认 `/data/slothvault`。启动／停止作用于整个受管实例；重启只作用于 slothvault 应用。安装仍支持 SQLite、MySQL、PostgreSQL，保留现有及历史 Compose 管理标记。

旧 `install.py --action ...`、`--bridge`、快照协议、Nginx、HTTPS 和证书管理不再提供；对应系统配置和既有续期任务不会自动删除。原有数据路径、端口绑定和数据库配置保留。应用更新固定正式版本，先拉取再激活，重建后核验实际运行镜像、发布标识和健康；重建前失败保留原配置，重建后不自动回退可能已迁移的数据。

随包 `USAGE.md` 是独立工具的操作说明。部署脚本自行更新需重新下载官方归档，应用版本和脚本版本分别管理。SlothTool 的显式旧数据清理仅移除经验证的旧受管脚本，不删除部署实例、数据库、代理或证书，也不修改原生 MCP 配置。
