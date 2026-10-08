# SlothVault 原生 MCP 接入与配置弹窗实施提示词

SlothTool 本轮已移除独立 MCP Client 的安装更新、Python 虚拟环境、命令注册、Profile 管理和连接检查页面。SlothTool 只管理 Deployment 和 Skill；智能体使用宿主的原生 MCP 连接。旧 Client 与 Profile 路径仅保留本地清理兼容。

把下面完整文本交给处理 SlothVault 仓库的代理即可。本文件是另一仓库的实施要求，配置弹窗尚未在本仓库实现。截图参考的是交互布局，示例 Token 不可使用或复制进源码。

```text
请在 SlothVault 仓库完成“移除独立 MCP Client，改为智能体原生 MCP 接入，并提供一次性接入配置弹窗”。

先读取 AGENTS.md、integrations/ARCHITECTURE.md、integrations/PROTOCOL.md、integrations/SYNC_UPDATES.md，以及 MCP 服务端、Key 管理、Skill 和独立包发布实现。保持当前技术栈，遵守仓库验证与版本规则。无需修改 SlothTool 仓库。

一、删除独立 Client，保留标准 MCP 服务端

1. 移除 integrations/mcp-client 中的 Python CLI、依赖锁、Profile 存储、CLI 确认、脱敏调用历史、测试及 Client 独立打包发布入口。检查 scripts、workflow、协议文档和示例中的引用，停止生成 mcp-client-v* 新 Release。不要删除或重发历史 GitHub Release。
2. 检查旧 integrations/slothvault-runtime 整包中的 Client、独立 slothvault-mcp 命令、Profile 和 setup/register 代码。按当前实际使用关系拆除，不能留下另一条仍能重新安装或执行 Client 的路径，也不要恢复旧整包分发。
3. 保留 /mcp 的标准 Streamable HTTP、Bearer MCP Key 鉴权、管理员权限边界、Tool/Prompt/Resource 注册及业务规则。Codex、Claude Code 等使用原生 MCP 客户端直连，服务端不得要求它们安装 SlothTool 或专用 Python 包。
4. /mcp/compatibility 与 MINIMUM_ADMIN_MCP_CLIENT_VERSION 当前服务于专用 Client，移除这一最低专用客户端版本策略；保留标准 MCP 协议协商和正常服务端版本信息。如果其他消费者实际使用该扩展接口，先明确兼容过渡并写入文档，不要将 Codex 自身版本当成专用 Client 版本比较。
5. 保留 Deployment 独立脚本、deployment-v* 发布、桥协议和现有应用部署能力。不要把部署与原生 MCP 接入绑定。
6. 代码改造不应直接清理开发者机器上的 Profile、Key、已部署应用、数据库或智能体配置；遗留本地数据由明确的清理流程处理。

二、Skill 改为使用宿主原生 MCP

1. 继续以 skill-v* 独立发布 Skill，保留现有 slothvault-mcp 目录和 Skill 名称，避免破坏受管链接。
2. 改写 integrations/skill/slothvault-mcp/SKILL.md、agents/openai.yaml、references 和示例。移除运行 slothvault-mcp CLI、doctor、tools list/show/call、--args-file、--yes、Profile、安装 Client、注册命令和 Python 环境等要求。
3. 引导智能体使用当前宿主已连接并发现的 SlothVault MCP 工具和实际 schema；宿主未接入时指导用户获取网站上的原生接入配置，不索要聊天中的明文 Key。
4. 保留草稿/发布、正文冻结、附件复用、发布前校验、失败回查、避免重复写入等业务流程说明。授权边界由用户任务、宿主审批和服务端权限共同决定，不在 Skill 中额外建立 CLI 确认机制。
5. 保持服务端工具说明、annotations 与业务约束准确；如补充 MCP 初始化 instructions，使用它提供跨工具业务指导，不硬编码宿主生成的工具前缀。
6. 更新 Skill 版本、CHANGELOG 和发布测试。发布新 Skill 后，SlothTool 的 skill install/update 可直接同步，不需要 Client。

三、在管理网站开发接入配置获取弹窗

基于 src/components/admin/mcp-keys-manager.tsx 及 /api/admin/mm/mcp/keys 的现有新建 Key 流程实现。当前 Key 服务只保存哈希，新建响应才返回完整 Key；必须保留这一边界。

推荐用户流程：
- 在管理员 MCP Key 页提供“获取接入配置”入口，复用名称、有效期等现有 Key 创建表单。
- 用户明确创建后，使用该次返回的完整 Key 显示“智能体接入配置”弹窗，替代仅展示原始 Key 的反馈。
- 如果已有 Key 已关闭一次性展示，不能从服务端恢复明文。已有 Key 的说明入口只提供地址/占位模板，或明确引导创建新 Key。不要伪装为“查看配置”却静默创建、轮换或废弃旧 Key。

弹窗参考截图的结构与体验：
- 顶部标题和关闭按钮。
- 一条明显的提示：“配置包含访问令牌，请勿提交到代码仓库或发送给他人。”
- 说明：“令牌仅展示一次。将对应配置加入客户端后即可使用。”
- Codex 区：右上角“复制”按钮，下方只读 TOML 配置块。
- Claude Code 区：右上角“复制”按钮，下方只读 CLI 命令块。
- 底部“我已保存配置”按钮。点击或关闭都清空本次明文，不表示后端已经替用户配置了客户端。
- 支持浅色、深色和移动端；长 URL/Key 可滚动或换行，复制始终使用完整原文。正常/错误/警告文字和边框均有足够对比度，复制成功和失败有明确反馈。
- 使用现有 Ant Design、next-intl 和页面样式体系，补齐中文和英文文案；保留键盘关闭、焦点管理和屏幕阅读器标签。

Codex 模板示意：

[mcp_servers.slothvault]
url = "https://your-vault.example/mcp"
http_headers = { Authorization = "Bearer <本次新建的 SlothVault MCP Key>" }
default_tools_approval_mode = "auto"
tool_timeout_sec = 120

Claude Code 模板示意：

claude mcp add --transport http --scope user --header 'Authorization: Bearer <本次新建的 SlothVault MCP Key>' slothvault 'https://your-vault.example/mcp'

实现前核验 Codex 与 Claude Code 当前官方文档，确保配置项、参数和客户端行为正确；以上为目标示意，不能凭记忆假定未核验选项。Codex 参考官方 MCP 与配置文档，Claude Code 参考其官方 MCP 文档。两个模板直接连接同一 /mcp 服务，无需 command=python、stdio 转发器或额外安装包。approval mode 表示宿主策略，不改变服务端权限。

模板生成要求：
- 使用当前真实对外访问地址，支持 HTTPS、非默认端口、开发 localhost 和项目支持的部署路径。优先复用已验证的外部地址配置；缺失时按仓库实际部署约定使用当前页面 origin。不要信任未经验证的 Host/Forwarded Header，也不要拼进 /api/admin 或 locale 页面路径。
- 只允许有效 HTTP(S) MCP 地址；拒绝带用户名密码、注入字符或不支持的地址。避免重复追加 /mcp。
- 把配置生成提取成纯函数；TOML 字符串使用合法转义，CLI 参数使用正确 Shell 转义，不能用 JSON.stringify 当作 shell quoting。确认复制命令可原样使用，不因特殊字符变成额外命令。若提供 Windows 命令，应单独按对应 shell 生成并测试。
- 示例和测试只使用明显占位 Key，绝不能带截图 Token 或真实环境 Key。
- Key 仅保留在本次一次性弹窗的短暂内存。关闭、确认、组件卸载和新建流程切换时清空，清理 mutation result/cache 中残留的完整响应；不存入 query cache、localStorage、sessionStorage、URL、错误日志、分析埋点或持久化状态。
- 复制写入剪贴板由用户点击触发；失败时提供安全的手动选择方式，错误信息不能回显配置或 Key。不把“复制成功”视为“连接成功”。
- 服务端继续只保存 Key 哈希；Key 列表、详情、导出或普通 GET 不得新增明文恢复功能，不能为生成模板新增永久明文 Key 存储。
- 保留当前管理员只能管理自己的 Key、有效期、启停和删除能力，权限与账户状态继续在每次 MCP 请求验证。

四、验收与交付

1. Client 源码、依赖、构建和发布入口已删除；Deployment 和 Skill 可独立打包，网站 /mcp 继续提供标准协议。
2. 原生客户端能 initialize、发现和调用代表性只读 Tool；测试不限定 clientInfo.name 为 slothvault-mcp。无效/过期/禁用 Key 和非管理员权限被正确拒绝。
3. 保持代表性写操作的业务校验。Resource 下载/附件等原 Client 附加能力如仍为业务必需，验证原生宿主支持情况，明确其替代路径；不要悄悄删掉服务端业务能力。
4. 配置生成覆盖端口、HTTPS、localhost、合法部署路径、TOML 与 Shell 转义；生成结果不依赖 Client 或 SlothTool。
5. 弹窗覆盖新 Key 一次性展示、两处复制、失败反馈、确认/关闭后清空、旧 Key 无法恢复、不同管理员隔离，以及深浅色/移动端关键布局。
6. 测试确认完整 Key 不出现在列表、缓存、持久化和日志；不要将真实密钥纳入截图、快照或测试记录。
7. Skill 使用原生 MCP，保留业务流程；同步架构、协议、README、CHANGELOG 和 SlothTool 对接说明。
8. 按 AGENTS.md 执行最小充分检查和版本准备，分别处理应用变更与 Skill/Deployment 独立版本。不要重复发布已有 Tag；没有发布授权时只完成代码和验证，交付待发布信息。
9. 汇报修改文件、通过的命令、实际连通验证范围、剩余兼容问题，以及新的 Skill Release 信息或待发布状态。
```
