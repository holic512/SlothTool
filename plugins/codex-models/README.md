# Codex Models Plugin

`@holic512/plugin-codex-models` 是 SlothTool 的 Codex 自定义 provider 管理插件。它会读取 `~/.codex/config.toml`，请求 provider 的 `/models`，初始化跨厂商模型元数据库，并生成 Codex 可读取的完整 `model_catalog_json`。

默认无参数启动全屏 TUI；CLI 适合诊断、脚本化同步和一次性修复脚本生成。

## 安装

在线安装：

```bash
slothtool install codex-models
slothtool codex-models
```

离线安装：

```bash
slothtool install codex-models --file ./codex-models-offline.tgz
```

在一台已经安装该插件且运行时依赖完整的机器上，可以先生成离线归档：

```bash
slothtool bundle codex-models --output ./codex-models-offline.tgz
```

## 命令

```bash
codex-models
codex-models --tui
codex-models doctor [--json]
codex-models catalog sync [--output <path>] [--json]
codex-models model set <model-id> [--reasoning <effort>] [--json]
codex-models reasoning set <effort> [--json]
codex-models library list [--json]
codex-models library show <model-id> [--json]
codex-models repair create <model-id> [--output <dir>] [--json]
```

- `doctor`：读取 Codex 配置，使用已配置的 provider 凭据请求 `<base_url>/models`，检查当前模型是否由 provider 暴露，以及推理等级和目录状态；凭据不会打印到结果。
- `catalog sync`：合并 provider 元数据与内置模型库，原子写入完整 Codex 模型目录，并更新 `model_catalog_json`。
- `model set`：只有 provider 确认模型存在后才切换 `model`；可通过 `--reasoning` 同时设置推理等级。
- `reasoning set`：验证当前模型支持目标等级后更新 `model_reasoning_effort`。
- `library list/show`：查看内置模型画像和指定模型最终解析结果。
- `repair create`：只生成一次性离线修复脚本，不直接修改 Codex Desktop 数据。

## TUI 操作

```text
↑ / ↓     选择模型
← / →     切换所选模型的推理等级
Enter     确认切换模型和推理等级
c         同步 model_catalog_json
y         确认待执行写操作
r         生成 Desktop 离线修复脚本
d         刷新诊断
q / Esc   退出
```

详情面板显示厂商、系列、上下文窗口、支持的推理等级、默认等级、输入模态、联网搜索、并行工具能力以及元数据来源。

## 跨厂商模型库

当前初始化库覆盖以下常见模型族：

- OpenAI GPT、Codex、gpt-oss、GPT Image
- Anthropic Claude
- Google Gemini
- xAI Grok
- DeepSeek
- Alibaba Cloud Qwen / QwQ
- Mistral / Codestral / Devstral
- Moonshot Kimi
- Zhipu GLM / ChatGLM
- MiniMax / ABAB
- Meta Llama
- Cohere Command
- Amazon Nova
- Microsoft Phi
- Baidu ERNIE
- ByteDance Doubao
- 01.AI Yi
- Tencent Hunyuan
- Baichuan
- Shanghai AI Lab InternLM
- StepFun Step
- SenseTime SenseNova
- NVIDIA Nemotron
- AI21 Jamba
- IBM Granite
- Perplexity Sonar

解析优先级为：

```text
provider 显式能力字段
→ 内置已核验模型画像
→ 厂商兼容画像
→ 未知模型保守回退 low / medium / high
```

provider 返回的 `context_window`、`supported_reasoning_levels`、`default_reasoning_level`、联网搜索、并行工具、推理摘要和输入模态等显式字段优先于内置值。未知字段和认证内容不会写入模型目录。

`gpt-5.6-sol` 被视为 provider 扩展模型，内置支持：

```text
none / low / medium / high / xhigh / max / ultra
```

其中 `max` 和 `ultra` 是该 provider 扩展画像，不代表所有 OpenAI-compatible provider 都接受这些值；provider 若返回自己的推理等级列表，以 provider 元数据为准。

## Desktop 修复安全边界

生成的脚本必须在 **Codex Desktop 完全退出后**，从独立 Terminal 手动执行。脚本会：

1. 检查 `~/Library/Application Support/Codex/Default/Local Storage/leveldb/LOCK`，并用 `lsof` 确认没有进程占用。
2. 修改前完整备份 LevelDB 目录。
3. 使用 Codex / ChatGPT App 内置的 `classic-level`。
4. 解码 Chromium Local Storage 的 UTF-16LE / UTF-8 标签。
5. 解析所有 `statsig.cached.evaluations.*`，仅修改动态配置 `107580212` 的 `available_models` 和 `use_hidden_models`。
6. 不修改 `default_model`，写后重新打开数据库验证。

脚本不会修改 `app.asar`，不会使用 `launchctl`，也不会把 `models_cache.json` 当作修复手段。

`--freeze-statsig-cache` 会更新评估缓存时间，降低下一次启动立即覆盖修复结果的概率，但会暂时冻结该缓存身份的其他 Statsig 更新。回滚可选择：

- 在 Codex 完全退出时恢复脚本输出的完整备份；
- 执行生成脚本的 `--clear-evaluations`，删除 Statsig 评估缓存并让 Desktop 后续重新获取。
