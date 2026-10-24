---
name: slothtool
description: 用 SlothTool 管理官方插件与内置 Skill；处理“打包项目”（pzip ZIP 归档，非编译构建）、“代码有多少行/统计代码量”（loc）、“批量压缩图片”（image-compress）、用 gstore 同步配置数据，以及 SlothVault 部署包与 Skill 管理。
metadata:
  version: "2.11.0"
---

# SlothTool

通过已安装的 SlothTool 显式 CLI 完成任务；仅加载对应能力的参考文件，不进入 TUI。

## 入口与权限

1. 先确认 `slothtool` 可执行文件可用，再运行 `slothtool --help`、`slothtool list` 查看能力与已安装插件。若主程序缺失，停止并告知用户安装前置条件；不得自行 `npm install -g`、`npx` 临时下载主程序或自动更改 PATH。
2. 需要的插件未安装时，可在当前任务范围及环境网络、文件写入权限允许下自动运行 `slothtool install <alias>`，仅限 `loc`、`image-compress`、`gstore`、`pzip`、`slothvault` 五个官方别名。需要环境批准时先走批准流程；失败、拒绝或平台不支持时停止该路径，不改装任意 npm 包、不绕过离线约束。离线来源由用户提供，见根管理参考。
3. 安装插件不等于获准执行它的所有能力；尤其不自动登录、创建远端仓库、上传数据、部署、删除、替换 Skill 链接或下载 SlothVault 独立包。外部写入、覆盖和破坏性动作先核对用户对具体目标与影响的授权。
4. 始终提供子命令或目标路径。不要运行裸 `slothtool`、裸 `slothtool <plugin>`、`tui`、`--tui`、`-i` 或 `--interactive`。没有通用 `--cli` 开关；仅给实际支持的命令加 `--json`。
5. 保留用户已有过滤器、排除规则、配置和输出要求；不为“完整统计/打包”重置配置或擅自关闭过滤。任务与现有配置冲突时说明差异并取得授权。命令与当前安装版本不一致时检查该命令的帮助；不推测参数。

## 按能力加载

- 安装、更新、卸载、离线插件归档、管理器设置与内置 Skill 链接：[根管理](references/root-management.md)。
- 目录文本行统计与统计过滤：[loc](references/loc.md)。
- 图片压缩、尺寸限制与独立输出：[image-compress](references/image-compress.md)。
- 目录归档与过滤预览：[pzip](references/pzip.md)。ZIP 归档不等于编译构建，也不等于官方插件离线 bundle。
- 设置、插件配置和数据的 Git 同步：[gstore](references/gstore.md)。
- SlothVault UI、独立 Deployment/Skill 包管理与旧数据清理：[SlothVault](references/slothvault.md)。本 Skill 不处理 Vault 文章等业务，不读取或写入凭据，不实现 MCP Client/runtime。

## 结果

报告执行的目标、实际输出路径、统计/压缩/同步结果及警告。预览不能声称已生成产物，包已安装不能声称应用已部署，命令失败不能声称操作成功。不要把密钥、Token、Cookie 或凭据内容带入日志与总结。
