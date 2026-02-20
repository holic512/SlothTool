# plugin-ai 设计文档（草案）

目标：仿照 Claude Code 的对话体验，在终端里做一个 AI 助手。
核心约束：LLM **必须只返回 JSON**，由本地解析/执行。

本插件使用现有的 `llm-base` 插件作为底层 LLM 能力层（OpenAI 协议兼容调用 + 严格 JSON 输出兜底）。

---

## 0. 已确定的关键决策

- 运行别名：**ai**（用户希望 `slothtool ai ...`）
- bin 名：保持 `ai`（不改成 ai-cli）
- `cmd` 表达：**program + args**（不接受一整段 shell string）
- 调用 llm-base 方式：**通过 ~/.slothtool/registry.json 定位已安装的 llm-base**（不作为 npm 依赖）

### 0.1 重要注意：当前 SlothTool 的 alias 规则

SlothTool 目前用包名推导 alias：`packages/slothtool/lib/utils.js:54-62`。

- 通过将 npm 包名设置为 `@holic512/plugin-ai`，安装后 alias 将是 **ai**（符合目标体验）。

---

## 1. 范围（Scope）

### 1.1 本插件负责

- 交互式对话（先用 `prompts` 跑通；后续切换到 Ink CLI UI）
- 维护会话上下文（见第 6 节：上下文管理）
- 通过 registry 找到 `llm-base` 并调用其 `llm_chat(messages, mode, profile)`
- 解析模型 JSON，根据 `type` 分发：
  - `chat`：在终端展示文本
  - `cmd`：请求执行命令（必须走权限/确认/环境校验）
- 命令执行安全控制（确认、allowlist、危险命令拦截、结果回传摘要）

### 1.2 本插件不负责

- 不实现 LLM provider / 鉴权 / HTTP（交给 llm-base）
- 不做“自动化无限执行”，所有命令执行必须显式确认

---

## 2. 依赖能力：llm-base 的严格 JSON 兜底

`llm-base` 已内置严格 JSON 输出系统提示词：`packages/plugin-llm-base/lib/client.js:6-13`。

并且当模型未按要求返回合法 JSON 时，会兜底成对象（示例）：

```json
{"result":"原始文本","_fallback":true,"_reason":"model_output_was_not_valid_json"}
```

对本插件的意义：
- 我们可以把“模型输出”当作 JSON object 解析（至少有兜底结构）
- 但仍需进行协议校验（例如 `type` 缺失、字段类型不对）

---

## 3. 调用 llm-base 的方式（通过 registry，4B）

### 3.1 为什么不用 llm-base CLI

`llm-base chat "..."` 只方便单轮输入；我们需要多轮 `messages[]`。
所以走 **require llm-base 的 lib/index.js** 更合适。

### 3.2 定位 llm-base

数据来源：`~/.slothtool/registry.json`（由 slothtool 管理）。

步骤（设计）：
1. 读取 registry JSON
2. 找到 alias = `llm-base` 的条目（或 name = `@holic512/plugin-llm-base`）
3. 拿到 `binPath`，推导 llm-base 模块根目录：
   - `.../bin/llm-base.js` 的上一级就是模块根目录
4. `require(<moduleRoot>/lib/index.js)`，拿到 `llm_chat()` 方法

### 3.3 缺失处理

如果 registry 中找不到 llm-base：
- 提示用户先执行：`slothtool install @holic512/plugin-llm-base`
- 或在交互界面提供“一键安装”入口（后续实现）

---

## 4. 对话协议（模型 JSON Schema，草案）

LLM 每次响应必须是一个 JSON object（即 `llm-base` 返回结构里的 `data` 字段）。

### 4.1 顶层结构

```json
{
  "type": "chat" | "cmd" | "error",
  "message": "给用户看的文本",
  "data": {}
}
```

---

## 5. type=chat

```json
{
  "type": "chat",
  "message": "给用户看的文本",
  "data": {
    "format": "plain" | "markdown",
    "suggestions": ["可选建议1", "可选建议2"]
  }
}
```

本地行为：
- 直接渲染 `message`

---

## 6. type=cmd（3A：program/args）

```json
{
  "type": "cmd",
  "message": "为什么要执行这些命令（简短）",
  "data": {
    "cwd": "/abs/path/or/null",
    "commands": [
      {
        "program": "git",
        "args": ["status"],
        "requires": {
          "confirm": true,
          "elevated": false,
          "network": false,
          "write": false
        }
      }
    ],
    "expected_effect": "预期效果（简短）"
  }
}
```

### 6.1 执行原则

- **不执行 shell string**（避免注入/转义/拼接风险）
- 使用 `spawn(program, args, {stdio:'inherit'})` 或捕获 stdout/stderr 后再展示
- 对 `program` 做 allowlist（第一版可非常小）
- 一律二次确认：`requires.confirm === true` 或触发风险策略时
- 明确拒绝：
  - `sudo` / 提权
  - 删除/破坏性命令（`rm -rf`、格式化磁盘等）
  - 未允许的网络访问

---

## 7. 权限与安全策略（草案）

### 7.1 权限模型

- 默认：只允许只读/信息类命令（如 `git status`, `ls`, `cat` 等）
- 写入/删除/网络：必须显式确认，并且可以通过配置进一步限制

### 7.2 配置位置（随 alias）

期望 alias=ai 时：`~/.slothtool/plugin-configs/ai.json`

配置项草案：
- `allowedPrograms`: string[]
- `allowNetwork`: boolean
- `allowWrite`: boolean
- `allowSudo`: boolean
- `defaultMode`: `low | high`
- `defaultProfile`: string | null

---

## 8. 上下文管理机制（简单、可复用、省 token）

目标：多轮对话中，**prompt 尺寸保持稳定**，避免把完整历史无限追加。

### 8.1 Context 结构（建议）

在本地维护一个 session（内存为主，可选落盘）：

```json
{
  "version": 1,
  "summary": "(短摘要，固定上限)",
  "recent": [
    {"role":"user","content":"..."},
    {"role":"assistant","content":"..."}
  ],
  "toolDigest": [
    {
      "program": "git",
      "args": ["status"],
      "exitCode": 0,
      "stdoutTail": "...",
      "stderrTail": "..."
    }
  ]
}
```

设计要点：
- `summary`：对“长期有效信息”的压缩（目标、约束、已做的决定、关键结论）。
- `recent`：只保留最近 N 轮（例如最近 6～10 条 message），保证模型有短期上下文。
- `toolDigest`：命令输出只保留 tail + 结构化元信息（不要把整段 log 全塞回模型）。

### 8.2 构造给 llm-base 的 messages（稳定窗口）

每次调用时，组装 messages：
1) system：协议/安全规则（固定文本）
2) system：`summary`（若为空可省略）
3) system：`toolDigest`（只给最近 1～3 条、并截断）
4) recent：最近 N 条 user/assistant
5) user：本轮输入

这样能把每次请求的 token 控制在一个上限。

### 8.3 何时触发“压缩/总结”

采用简单规则即可（不需要精确 tokenizer）：
- `recent` 超过 N 条就触发
- 或 `recent` 的字符总量超过阈值（例如 8k～12k chars）
- 或 `toolDigest` 单条输出超过阈值（只保留 tail）

### 8.4 如何生成 summary（两种实现路线）

- 路线 A（更简单、易实现）：
  - 当触发阈值时，用 llm-base 再发起一次“总结请求”，让模型输出一个 JSON：

    ```json
    {"summary":"...","keyFacts":["..."],"openTasks":["..."]}
    ```

  - 将新 summary 覆盖旧 summary，并清空/裁剪旧 recent。

- 路线 B（更省调用次数）：
  - 要求模型在每次正常响应时顺带输出 `data.contextPatch`（很短），本地把 patch 合并进 summary。

第一版建议先做路线 A，逻辑更直观，也更可复用。

### 8.5 额外省 token 技巧（建议）

- assistant 历史不要存完整 JSON：只保存 `type + message +（执行过的命令摘要）`
- 命令输出不回传全文：只回传摘要/最后 N 行
- 对可能的敏感信息做简单脱敏后再回传（例如疑似 key/token 的模式）

---

## 9. MVP（最小可用）

1) `slothtool ai -i` 启动交互
2) 用户输入一行
3) 组装 messages（summary + recent window）
4) 调用 llm-base 得到模型 JSON（严格 JSON）
5) 分发：
   - `chat`：打印 `message`
   - `cmd`：展示命令 + 二次确认 + 执行 + 记录 toolDigest（只保留 tail）

---

## 10. AI 调用连续性（Agent Loop：cmd → 结果 → 再次调用 AI）

你描述的“先搜索（cmd），拿到列表 JSON，再问 AI 下一步”本质上就是 **工具调用循环**（ReAct/Agent loop）。

关键点：
- 第 1 次 AI 调用只能提出“要执行什么命令”，因为它还看不到输出。
- **命令执行后的输出（Observation）必须进入下一次 AI 调用**，让 AI 基于真实结果继续。

### 10.1 推荐做法：连续性由 Runner 驱动（不需要 `type=ai`）

为了简单、可复用、可控，我建议把“继续调用 AI”作为 **Runner 行为**，而不是让模型返回一个 `type=ai` 再套一层。

流程：
1) AI 返回 `type=cmd`
2) Runner 执行命令，生成 `tool_result`（结构化 + 截断）
3) Runner 立刻用 `tool_result` 触发下一次 `llm_chat()`
4) AI 基于结果再返回 `chat` 或下一个 `cmd`
5) 直到产出 `chat`（或达到步数上限）

这样做的好处：
- 协议更小：模型只需要学会输出 `chat/cmd`
- 安全更强：不会出现“模型让你用某个奇怪 prompt 再问一次自己”的不可控链
- 更省 token：第二次调用直接让模型做决策，不再做“生成提问再提问”的额外一跳

### 10.2 tool_result（Observation）输入格式（建议固定）

Runner 在命令执行完后，生成一个 JSON 对象（并把它作为下一轮 messages 的输入之一）：

```json
{
  "_event": "tool_result",
  "tool": "cmd",
  "id": "cmd_001",
  "cwd": "/abs/path/or/null",
  "program": "rg",
  "args": ["ensureJsonObject", "packages"],
  "exitCode": 0,
  "durationMs": 123,
  "stdoutTail": "...最后 N 行...",
  "stderrTail": "",
  "truncated": true,
  "parsed": {
    "kind": "search_matches",
    "total": 12,
    "items": [
      {"file": "packages/plugin-llm-base/lib/client.js", "line": 157, "text": "function ensureJsonObject(content) {"}
    ]
  }
}
```

设计要点：
- **不要把 stdout 全量塞回模型**：只给 tail + parsed 列表（items 限制条数）
- `parsed.kind` 用于让模型快速理解结果类型
- `id` 用于在 session 中引用/追踪（可选）

### 10.3 Continue 触发消息（建议固定文本，省 token）

命令跑完后，Runner 追加一个很短的“继续”输入即可：

```json
{ "_event": "continue" }
```

系统提示词里提前约定：当看到 `_event=tool_result` + `_event=continue` 时，模型要根据结果输出下一步 `chat/cmd`。

### 10.4 步数上限（防止无限循环）

每次用户输入（一个 user-turn）允许 Runner 自动执行/自动继续的步数建议设上限：
- `maxAutoStepsPerTurn`：例如 3

超过上限就暂停，把当前进展用 `chat` 展示给用户，并询问是否继续。

### 10.5 如何省 token：优先“本地结构化”，再给 AI

你的“列表 JSON”最好由 Runner 从命令输出中**本地解析**出来（比如 search matches、文件列表、git porcelain 状态），再喂给 AI。

原因：
- 结构化比原始文本更短
- 更不容易让 AI 误读
- 更可复用（同一个 parser 可服务很多场景）

### 10.6 例子：搜索 → 读文件 → 给建议（连续两次 cmd）

- 回合 1：AI 返回 cmd（搜索）
- Runner 执行并生成 tool_result（matches 列表）
- 回合 2：AI 看到 matches，返回 cmd（读取命中最多的文件片段）
- Runner 执行并生成 tool_result（file snippet）
- 回合 3：AI 返回 chat（总结发现 + 下一步建议/提问）

这就是 Claude Code 类“边查边想”的连续性。

---

## 11. 风险分级与自动执行策略（选择 B）

目标：**低风险命令自动执行**；中高风险命令必须确认；高危命令直接拒绝。

### 11.1 风险等级（建议）

- L0 SAFE（可自动执行）
  - 只读/查询类，且命中 allowlist 规则
  - 例：`pwd`, `ls`, `git status`, `git diff`, `git log --oneline`, `rg <pattern> <path>`
- L1 CONFIRM（需要确认）
  - 可能写入、可能大量变更、可能触网、可能耗资源
  - 例：`npm install`, `npm update`, `git add`, `git commit`, `slothtool install/uninstall/update`, 任何 file 写入
- L2 BLOCK（默认拒绝）
  - 破坏性/提权/不可逆风险
  - 例：`sudo ...`, `rm -rf`, `dd`, `mkfs`, `chmod -R`, `chown -R`, `git reset --hard` 等

### 11.2 自动执行规则（B 的落地）

Runner 对每个 step 做判定：
1) 是否在 `allowedPrograms`（allowlist）内；不在则拒绝
2) 计算风险等级 L0/L1/L2
3) 执行策略：
   - L0：自动执行
   - L1：必须 prompts 二次确认
   - L2：直接拒绝（除非未来加“超强确认 + 配置开关”，第一版不做）

### 11.3 风险判定要“可解释”

当 Runner 要求确认或拒绝时，应输出：
- 命中的规则（例如：`network=true` / `write=true` / `sudo detected`）
- 用户可选动作（确认 / 取消 / 修改命令）

---

## 12. Skill / Tool 机制：如何调用 slothtool 插件

你问“是不是要专门写 skill 机制？”——**需要一个机制，但不一定要做成很多独立插件**。

推荐：在 ai 插件内部实现一个“Tool Runner”，把能力抽象成少量通用工具：
- `exec`：执行外部命令（program + args）
- `plugin.run`：运行已安装的 slothtool 插件（通过 registry 定位 binPath）
- `config.json_patch`：编辑 JSON 配置文件（读 → patch → 写）

这样：
- 对模型来说：它在 JSON 里选择要调用的 tool（像 Claude Code 的 tools）
- 对实现来说：不用为每个插件写一个 skill，通用 runner 足够

### 12.1 plugin.run 的实现思路（复用 slothtool 的 registry）

slothtool 运行插件本质是：`spawn('node', [plugin.binPath, ...args])`：`packages/slothtool/lib/commands/run.js:30-32`。

ai 插件也可以复用同样逻辑：
1) 读取 `~/.slothtool/registry.json`
2) 查到目标 `pluginAlias`
3) `spawn('node', [binPath, ...args])`
4) 捕获 stdout/stderr（或 inherit）并生成 `tool_result`

### 12.2 交互式插件如何处理

很多插件声明了 `slothtool.interactive=true`（例如 svn/systemd/loc）。
- 默认：`plugin.run` 只允许 **非交互**（可捕获输出）
- 如果必须运行交互式：要求用户确认，并使用 `stdio:'inherit'`（会打断 Ink UI；第一版先接受这个限制）

### 12.3 工具清单如何给模型（省 token）

不要每轮塞一大段“工具说明”。建议：
- system prompt 只放“通用 tool 协议”
- session summary 里放“当前可用插件 alias 列表”（短字符串）
- 当 AI 不确定时，让它先 `plugin.run` 执行 `--help` 或 `slothtool list` 获取信息（受风险策略控制）

---

## 13. 配置文件编辑：要不要单独做一个 CRUD 脚手架插件？

结论（建议）：**第一版不要拆成独立插件**，先在 ai 插件内部实现 `config.json_patch` 工具。

原因：
- 拆独立插件并不会减少复杂度：安全策略、确认机制、diff 展示还是要在 ai 里做
- 早期频繁改协议/策略，放在同一个包里迭代成本最低

### 13.1 config.json_patch（推荐能力边界）

只做“受限的 JSON 配置操作”，而不是任意文件编辑：
- 允许目标路径：
  - `~/.slothtool/settings.json`
  - `~/.slothtool/plugin-configs/*.json`
  - （可选）项目内某些明确白名单路径
- 操作表达：JSON Patch（RFC6902 风格）或更简单的 `set/unset`
- 写入前展示 diff 摘要并确认

### 13.2 什么时候再拆成独立包/插件

当出现以下情况再拆：
- 多个插件都需要复用同一套“安全 JSON patch + diff + 备份”能力
- 你希望把“文件写入能力”从 ai 插件隔离（降低 ai 插件权限）

---

## 14. 实施顺序（让 AI 一步一步完成）

下面是推荐的执行顺序（每一步都能独立验收，不要求一次写完）。

### Step 0：命名对齐（已选择 0A）

- 包名使用 `@holic512/plugin-ai`
- alias 将是 `ai`（由 slothtool 的 alias 规则决定：`packages/slothtool/lib/utils.js:54-62`）

### Step 1：跑通最小对话（只支持 chat）

- `ai -i` 进入循环输入
- 调用 llm-base（通过 registry require）
- 只处理 `type=chat`：打印 message

验收：能稳定多轮对话。

### Step 2：引入 cmd + 执行器（exec tool）

- 支持 `type=cmd`（先只允许 `exec`）
- `spawn(program,args)` 捕获输出 → 生成 `tool_result`
- 加入 `maxAutoStepsPerTurn`（防循环）

验收：AI 可以“提出 1 个安全命令 → 自动执行 → 再继续回答”。

### Step 3：加入风险分级（B 策略）

- 实现 allowlist + 风险判定（L0/L1/L2）
- L0 自动执行；L1 prompts 确认；L2 拒绝
- 把判定原因写入 `tool_result`（可解释）

验收：安全命令自动跑，危险命令会被拦住/确认。

### Step 4：加入 plugin.run（调用其他 slothtool 插件）

- 通过 registry 定位任意插件 alias 的 binPath
- 默认只允许非交互式插件（可捕获输出）
- `tool_result.parsed.kind="plugin_output"`

验收：AI 可以调用 `loc` 等插件获取信息，再基于输出继续。

### Step 5：加入 config.json_patch（编辑配置文件）

- `read → apply patch → diff 摘要 → 确认 → write`
- 路径限制在 `~/.slothtool/...`

验收：AI 能帮你改 `settings.json` 或某插件配置，并且可回滚（至少有备份/提示）。

### Step 6：把上下文管理（summary + recent window）接入工具循环

- 触发阈值 → 用 llm-base 做 summary
- tool_result 只保留 parsed + tail

验收：长对话 token 不爆炸，仍能保持连续性。

### Step 7：再考虑 Ink UI（最后做）

- 先把协议/安全/工具循环稳定下来
- Ink 只是展示层替换
