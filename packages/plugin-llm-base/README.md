# @holic512/plugin-llm-base

`llm-base` 是 SlothTool 的基础 LLM 能力插件，专注提供三件事：

1. 配置管理（profile）
2. OpenAI 协议兼容调用
3. 调用日志

> 设计边界：不承载业务逻辑、不内置行业提示词、不直接产出最终业务结论。

---

## 1. 安装与入口

```bash
slothtool install @holic512/plugin-llm-base
```

安装后可用命令：

```bash
slothtool llm-base --help
# 或直接执行插件命令
llm-base --help
```

---

## 2. 配置文件与数据文件

### 2.1 主配置

路径：`~/.slothtool/plugin-configs/llm-base.json`

结构示例：

```json
{
  "default_profile": "local",
  "profiles": {
    "local": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-xxxx",
      "low_model": "gpt-4o-mini",
      "high_model": "gpt-4o",
      "timeout": 60000
    }
  }
}
```

### 2.2 调用日志

路径：`~/.slothtool/plugin-configs/llm-base.logs.json`

每条记录字段：
- `call_id`
- `timestamp`
- `profile`
- `model`
- `duration_ms`
- `success`
- `usage`

保留策略：仅保留最近 500 条。

---

## 3. CLI 使用

## 3.1 配置管理

```bash
# 创建 profile
llm-base config create <name>

# 更新 profile
llm-base config update <name>

# 删除 profile
llm-base config delete <name>

# 查看 profile 列表
llm-base config list

# 设置默认 profile
llm-base config set-default <name>

# 查看 profile 详情（默认脱敏）
llm-base config show <name>

# 导出配置（默认脱敏）
llm-base config export

# 交互式配置
llm-base -i
# 或
llm-base config -i
```

## 3.2 调用接口

### chat 调用（自动 low/high 模型）

```bash
# 默认 low 模式
llm-base chat "你好"

# high 模式
llm-base chat "请总结以下文本" --mode high

# 指定 profile
llm-base chat "hello" --mode low --profile local
```

### raw 透传调用

```bash
llm-base raw '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}'

# 指定 profile
llm-base raw '{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}' --profile local
```

---

## 4. 模块调用（供其他插件依附）

```js
const llmBase = require('@holic512/plugin-llm-base/lib/index');

// 配置管理
llmBase.create_profile(name, config);
llmBase.update_profile(profile_id, patch);
llmBase.delete_profile(profile_id);
llmBase.list_profiles();
llmBase.set_default_profile(profile_id);

// LLM 调用
await llmBase.llm_chat(messages, mode, profile);
await llmBase.llm_raw(payload, profile);

// 日志
llmBase.list_calls();
llmBase.get_call(call_id);
```

---

## 5. 返回结构约定

### 5.1 成功结构

```json
{
  "success": true,
  "model": "实际使用模型名",
  "data": "...",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0
  },
  "call_id": "uuid"
}
```

### 5.2 失败结构

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误说明"
  },
  "call_id": "uuid"
}
```

---

## 6. 错误码说明

- `NO_PROFILE`：默认 profile 不存在，或指定 profile 不存在
- `NETWORK_ERROR`：网络异常、连接失败、超时
- `AUTH_ERROR`：401/403
- `RATE_LIMIT`：429
- `PROVIDER_ERROR`：其余 provider 错误

---

## 7. 安全与隐私规则

- `config show/export` 默认脱敏（`api_key` 不明文）
- 日志不记录完整用户输入正文
- 不记录敏感 header（如 Authorization）
- 错误信息中不回显 `api_key`

---

## 8. 典型流程示例

1) 创建 profile 并设为默认

```bash
llm-base config create local
llm-base config set-default local
```

2) 发起 low/high 调用

```bash
llm-base chat "简要介绍 SlothTool" --mode low
llm-base chat "请做详细技术分析" --mode high
```

3) 检查调用日志

```bash
node -e "const api=require('./lib/index'); console.log(api.list_calls())"
```
