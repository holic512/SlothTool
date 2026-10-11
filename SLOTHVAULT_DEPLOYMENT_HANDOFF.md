# SlothVault Deployment 与管理界面对接

本地管理界面 3.1.0 与独立 Deployment 1.1.0 实现同一条应用更新流程：检查实际运行版本 → 展示固定目标 → 确认一次 → 拉取 → 重建 → 本地核验。发行、安装与远端生效分别进行；源码完成不表示服务器已升级。Skill 和应用版本保持独立发布边界。

## 桥协议主版本 1

保留 progress、log、prompt、snapshot、update、preview、error、done 和 stdin `answer/cancel`。以下都是可选扩展，旧 Deployment 缺失字段时退回普通输入和阶段展示：

| 事件 | 可选字段与含义 |
| --- | --- |
| prompt | `kind: "confirm"`、`default`；按 y 继续、n/Esc 取消。旧普通提示输入 y 后 Enter。`secret` 输入隐藏。 |
| preview.data | `currentVersion`、`targetVersion`、`image`、`root`、`impact`、`releaseCount`；只确认本次固定目标。 |
| progress | `phase`、`stageIndex/stageCount`、`subject`、`current/total/unit`、`speed`、`status`、`message`；计量取自实际命令。 |
| progress | `heartbeat: true` 只表示进程存活，不更新业务进度时间。长命令每 5 秒上报。 |
| snapshot.data | `appVersion`、`appVersionSource`、`runtimeImage`、容器状态及健康、`errors`；原 `image` 为配置镜像。 |
| done | `code`、`outcome: updated/unchanged/cancelled/failed`、更新前／目标／实际版本、`verified`、`health`；退出码与真实进程一致。其他动作可不提供 outcome。 |

JSON Compose 输出优先，旧环境采用 plain 或阶段提示。镜像层百分比仅属于标注的层；总量未知时不显示百分比。输出只保留安全阶段、计量和分类错误，不转发完整命令、环境变量和原始 stderr。

## 更新和核验边界

临时 Compose 与正式配置位于同一部署目录，仅拉取目标应用镜像。成功后激活正式配置并重建应用；重建前失败恢复原配置，重建后不自动回退。运行容器必须匹配已确认版本与目标镜像；健康检查最多等待 120 秒，每 2 秒检查，无健康检查明确标注。最终核验不再联网读取 GitHub。

前端优先接收最终快照，缺失时只补读一次；失败和取消也刷新实际状态。GitHub 最新版本记录自己的查询时间，联网失败不覆盖实际应用版本。前端同时检查容器运行、健康、版本证据和真实退出码；缺少证据显示“部分完成／待核验”，不会报告更新成功。Skill 更新后重新读取生效内容及链接，保留自定义冲突目标并明确显示未完全生效。

## 验证和发行

SlothTool 的 `test/slothvault-task-state.test.js`、`test/slothvault-manager-tui.test.js` 与组件测试覆盖输入计时、旧桥兼容、固定状态、计量、单次确认、取消、快照、退出码冲突和 Skill 链接。Vault Deployment 测试覆盖真实子进程管道、JSON/plain 解析、心跳、脱敏、暂存拉取、恢复边界及本地版本／健康核验。

独立发行契约为 `deployment-v1.1.0`、`slothvault-deployment-1.1.0.tgz`、`slothvault-deployment-manifest.json`，声明 Python 3.10+、`bridgeApiMajor: 1` 和 `protocolMajor: 1`。界面标签为 `plugin-slothvault-v3.1.0`。发布前复查标签未占用，并校验归档及逐文件 SHA-256。
