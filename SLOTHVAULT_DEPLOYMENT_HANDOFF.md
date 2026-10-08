# SlothVault Deployment 包对接提示词

SlothTool 只管理界面与独立 Deployment、Skill，智能体通过原生 MCP 连接服务端，并支持部署桥协议主版本 1 的新增可选进度字段。当前 SlothVault Deployment 脚本只发送阶段事件，SlothTool 显示阶段和耗时；真实镜像层进度需要在 SlothVault 仓库实现并独立发布。本次未修改另一仓库，也未执行真实部署。

下面文本可直接交给处理 SlothVault 仓库的代理。

```text
请增强 SlothVault 独立 Deployment 脚本包的 JSON-line 事件桥，
供 SlothTool 在右侧面板展示真实进度和完整结果。

先阅读 integrations 的架构、协议、同步说明及现有部署测试。
保持纯 Python 标准库、Python 3.10+ 和现有非 bridge CLI 行为。
包仍通过 deployment-v* Release 独立发布，不依赖 MCP Client、
Skill 或 SlothTool 的安装状态。

保留已有 progress、log、prompt、snapshot、update、preview、
error、done 事件，以及 stdin 的 answer/cancel 协议。
在桥协议主版本 1 内，通过新增可选字段增强 progress：

- phase：保留现有阶段标识。
- stageIndex、stageCount：能够确定时提供步骤位置和总数。
- subject：当前镜像、镜像层或任务对象。
- current、total、unit：实际完成量和总量；unit 使用 bytes 或 items。
- status：running、completed 或 failed。
- message：安全、可展示的说明。

无法确定总量时省略 total，不输出虚构百分比。
Docker 镜像拉取进度必须来自真实拉取过程；按镜像层上报，
没有完整总量时不要把局部百分比当成整体下载百分比。
不支持结构化进度的环境回退到阶段事件。

调整当前直接丢弃命令输出的执行路径，使 bridge 模式可以持续
提取安全的进度。覆盖镜像拉取、启动、验证以及现有 Nginx、
HTTPS、续约流程；长任务持续提供活动信息。

应用更新执行前发送 preview，说明实际当前版本和目标版本。
结束时发送包含实际版本、容器状态和健康状态的 snapshot。
error 提供可选错误代码、失败阶段及脱敏原因；
done.code 与真实进程退出码一致，取消保持可区分状态。

禁止向事件输出数据库密码、Key、Token、完整敏感命令或原始
敏感 stderr。保持 secret prompt 和取消行为。

补充旧事件兼容、实际进度、失败、取消、非 bridge CLI、
最终快照和敏感信息不泄漏测试。更新协议说明、事件示例、
模块 CHANGELOG，以及 SlothTool 已改为按 Tab 独立管理外部包
的同步说明。按仓库规则更新 Deployment 包版本，
提供 Release、资产、清单和通过的检查，勿重复发布已有 Tag。
```

现有独立发布契约继续保持：`deployment-vX.Y.Z`、`slothvault-deployment-X.Y.Z.tgz`、`slothvault-deployment-manifest.json`。清单校验归档及文件 SHA-256，并声明 Python 3.10、`bridgeApiMajor: 1` 与 `protocolMajor: 1`。

SlothTool 的接收层验证见 `test/slothvault-manager-tui.test.js`：兼容旧阶段事件、保留新增计量字段、无可靠总量时无百分比、真实进程退出码，以及不展示原始 stderr。实际 Docker 拉取、部署快照和敏感信息脱敏需由 Deployment 包自己的测试覆盖。
