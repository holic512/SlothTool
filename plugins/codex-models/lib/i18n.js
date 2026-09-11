/**
 * @file CodexModelsI18n
 * @project SlothTool
 * @module Codex Models Plugin / Internationalization
 * @description 提供 Codex Models 插件 CLI 与 TUI 的中英文文案，并与 SlothTool 全局语言设置保持一致。
 * @logic 优先读取显式语言覆盖与 ~/.pipker/slothtool/settings.json，缺失时回退 LANG，并替换消息中的命名参数。
 * @dependencies Node: fs/os/path
 * @index_tags i18n, codex, model catalog, reasoning effort, model library, bilingual
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const messages = {
    zh: {
        title: 'Codex 模型配置、模型库与 Desktop 修复',
        usage: '用法：',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 TUI。请改用显式 CLI 子命令。',
        help: [
            '  codex-models',
            '  codex-models --tui',
            '  codex-models doctor [--json]',
            '  codex-models catalog sync [--output <path>] [--json]',
            '  codex-models model set <model-id> [--reasoning <effort>] [--json]',
            '  codex-models reasoning set <effort> [--json]',
            '  codex-models library list [--json]',
            '  codex-models library show <model-id> [--json]',
            '  codex-models repair create <model-id> [--output <dir>] [--json]',
            '',
            'Desktop 修复脚本必须在完全退出 Codex 后，从独立 Terminal 手动执行。'
        ],
        doctorTitle: 'Codex 自定义模型诊断',
        model: '当前模型：{value}',
        reasoningEffort: '当前推理等级：{value}',
        provider: 'Provider：{value}',
        baseUrl: 'Base URL：{value}',
        credential: '凭据：{value}',
        catalog: '模型目录：{value}',
        models: 'Provider 模型数：{count}',
        activeAvailable: '当前模型由 provider 暴露：{value}',
        activeCatalog: '当前模型在目录中：{value}',
        activeReasoningSupported: '当前推理等级受支持：{value}',
        yes: '是',
        no: '否',
        catalogSynced: '已同步 {count} 个模型到：{path}',
        modelSet: '已将 Codex 当前模型设置为：{model}',
        modelAndReasoningSet: '已设置模型 {model}，推理等级 {effort}',
        reasoningSet: '已将模型 {model} 的推理等级设置为：{effort}',
        repairCreated: '已生成一次性离线修复脚本：{path}',
        repairNotice: '先完全退出 Codex，再在独立 Terminal 执行脚本。该脚本会检测 LOCK、完整备份 LevelDB、写后重新打开验证；它不会修改 app.asar。',
        tuiFooter: '↑↓ 选择模型  ←→ 切换推理等级  Enter 确认设置  c 确认同步目录  r 生成修复脚本  d 刷新  q 退出',
        tuiLoading: '正在读取 Codex 配置、provider /models 和内置模型库…',
        tuiStatus: '状态：{value}',
        tuiLoaded: '已加载 {count} 个模型',
        tuiConfirmModel: '确认设置模型“{model}”和推理等级“{effort}”？按 y 确认，其他键取消。',
        tuiConfirmCatalog: '确认同步并写入 {count} 个模型的 Codex 模型目录？按 y 确认，其他键取消。',
        tuiCancelled: '已取消操作。',
        selectedModel: '所选模型',
        libraryVendor: '厂商：{value}',
        libraryFamily: '系列：{value}',
        libraryContext: '上下文窗口：{value}',
        libraryEfforts: '推理等级：{value}',
        libraryDefaultEffort: '默认推理等级：{value}',
        librarySelectedEffort: '预选推理等级：{value}',
        librarySearch: '联网搜索：{value}',
        libraryModalities: '输入模态：{value}',
        librarySource: '元数据来源：{value}',
        libraryVerified: '元数据已核验：{value}',
        tui: {
            tabs: {models: '模型', diagnosis: '诊断'},
            panels: {models: '模型库'},
            empty: '等待模型数据。',
            resize: {title: '终端空间不足', description: '请至少调整到 30 列 × 14 行。'},
            footer: {
                models: 'Tab 切页  Up/Down 选择  Left/Right 推理等级  Enter 设置  c 同步目录  r 修复脚本  q 退出',
                diagnosis: 'Tab 切页  d 刷新  Esc 返回  q 退出'
            }
        }
    },
    en: {
        title: 'Codex Model Configuration, Library & Desktop Repair',
        usage: 'Usage:',
        tuiRequiresTerminal: 'The current terminal is not interactive. Use an explicit CLI command instead.',
        help: [
            '  codex-models',
            '  codex-models --tui',
            '  codex-models doctor [--json]',
            '  codex-models catalog sync [--output <path>] [--json]',
            '  codex-models model set <model-id> [--reasoning <effort>] [--json]',
            '  codex-models reasoning set <effort> [--json]',
            '  codex-models library list [--json]',
            '  codex-models library show <model-id> [--json]',
            '  codex-models repair create <model-id> [--output <dir>] [--json]',
            '',
            'The Desktop repair script must be run manually from a separate terminal after Codex is fully quit.'
        ],
        doctorTitle: 'Codex Custom Model Diagnosis',
        model: 'Active model: {value}',
        reasoningEffort: 'Active reasoning effort: {value}',
        provider: 'Provider: {value}',
        baseUrl: 'Base URL: {value}',
        credential: 'Credential: {value}',
        catalog: 'Model catalog: {value}',
        models: 'Provider model count: {count}',
        activeAvailable: 'Active model exposed by provider: {value}',
        activeCatalog: 'Active model in catalog: {value}',
        activeReasoningSupported: 'Active reasoning effort supported: {value}',
        yes: 'yes',
        no: 'no',
        catalogSynced: 'Synced {count} models to: {path}',
        modelSet: 'Set the active Codex model to: {model}',
        modelAndReasoningSet: 'Set model {model} with reasoning effort {effort}',
        reasoningSet: 'Set reasoning effort for {model} to: {effort}',
        repairCreated: 'Created one-time offline repair script: {path}',
        repairNotice: 'Fully quit Codex before running it from a separate terminal. It checks LOCK, creates a full LevelDB backup, and reopens for verification; it never edits app.asar.',
        tuiFooter: '↑↓ select model  ←→ reasoning effort  Enter confirm setting  c confirm catalog sync  r repair script  d refresh  q quit',
        tuiLoading: 'Reading Codex configuration, provider /models, and the built-in model library…',
        tuiStatus: 'Status: {value}',
        tuiLoaded: 'Loaded {count} models',
        tuiConfirmModel: 'Set model “{model}” with reasoning effort “{effort}”? Press y to confirm; any other key cancels.',
        tuiConfirmCatalog: 'Sync and write a Codex catalog with {count} models? Press y to confirm; any other key cancels.',
        tuiCancelled: 'Operation cancelled.',
        selectedModel: 'Selected model',
        libraryVendor: 'Vendor: {value}',
        libraryFamily: 'Family: {value}',
        libraryContext: 'Context window: {value}',
        libraryEfforts: 'Reasoning efforts: {value}',
        libraryDefaultEffort: 'Default reasoning effort: {value}',
        librarySelectedEffort: 'Selected reasoning effort: {value}',
        librarySearch: 'Web search: {value}',
        libraryModalities: 'Input modalities: {value}',
        librarySource: 'Metadata source: {value}',
        libraryVerified: 'Metadata verified: {value}',
        tui: {
            tabs: {models: 'Models', diagnosis: 'Diagnosis'},
            panels: {models: 'Model library'},
            empty: 'Waiting for model data.',
            resize: {title: 'Terminal is too small', description: 'Resize it to at least 30 columns × 14 rows.'},
            footer: {
                models: 'Tab page  Up/Down select  Left/Right effort  Enter set  c catalog  r repair  q quit',
                diagnosis: 'Tab page  d refresh  Esc back  q quit'
            }
        }
    }
};

export function getLanguage() {
    if (['zh', 'en'].includes(process.env.SLOTHTOOL_LANGUAGE)) {
        return process.env.SLOTHTOOL_LANGUAGE;
    }

    try {
        const settingsPath = path.join(os.homedir(), '.pipker', 'slothtool', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const language = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).language;
            if (['zh', 'en'].includes(language)) {
                return language;
            }
        }
    } catch {
        // Fall through to the terminal locale when the shared setting is unavailable.
    }

    return process.env.LANG?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key, values = {}) {
    const value = key.split('.').reduce((current, part) => current?.[part], messages[getLanguage()])
        ?? key.split('.').reduce((current, part) => current?.[part], messages.en);
    if (typeof value !== 'string') {
        return value;
    }
    return value.replace(/\{(\w+)\}/gu, (_, name) => String(values[name] ?? `{${name}}`));
}
