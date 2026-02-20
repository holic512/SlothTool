const fs = require('fs');
const path = require('path');
const prompts = require('prompts');
const pluginConfig = require('./config');
const {discoverCodexConfig} = require('./config-paths');
const {
    readCodexConfig,
    summarizeConfig,
    makeConfigPatch,
    buildDiff,
    writeConfigAtomic,
    getProviderNode
} = require('./codex-config');
const {getModesAndModels} = require('./modes-client');
const {createBackup, listBackups, restoreBackup} = require('./backup');
const {collectCleanupPlan, executePlan, summarizePlan} = require('./cleaner');
const ANSI = {
    reset: '\x1b[0m',
    yellow: '\x1b[33m'
};
const MANAGED_PROVIDER_ID = 'openrouter';
const MANAGED_MODEL = 'gpt-5.2';
const MANAGED_PROVIDER_NAME = 'OpenRouter';
const MANAGED_WIRE_API = 'responses';
const DEFAULT_BASE_URL = 'http://49.232.155.38:3001/v1';
const DEFAULT_API_KEY = 'sk-Y05xG2VcplDHVL4sfXLdFzzbpnFNbm7y0d8FjnQGpA13oAte';

function requireCodexConfigPath() {
    const discovery = discoverCodexConfig();
    if (!discovery.selected) {
        throw new Error('Codex config not found');
    }
    return discovery;
}

function getRuntimeContext() {
    const runtime = pluginConfig.readConfig();
    const discovery = requireCodexConfigPath();
    const read = readCodexConfig(discovery.selected);
    const summary = summarizeConfig(discovery.selected, read.data);

    return {
        runtime,
        discovery,
        configPath: discovery.selected,
        configRaw: read.raw,
        configData: read.data,
        summary
    };
}

function toJson(value) {
    return JSON.stringify(value, null, 2);
}

function output(result, asJson) {
    if (asJson) {
        return toJson(result);
    }

    if (typeof result === 'string') {
        return result;
    }

    return toJson(result);
}

function normalizeModelValue(value) {
    return String(value || '').trim();
}

function maskKey(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }
    if (text.length <= 10) {
        return '***';
    }
    return `${text.slice(0, 6)}***${text.slice(-4)}`;
}

function readAuthKey(authPath) {
    if (!fs.existsSync(authPath)) {
        return '';
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        return String(parsed && parsed.OPENAI_API_KEY || '').trim();
    } catch (error) {
        return '';
    }
}

function buildInteractiveModelChoices(models, currentModel) {
    const list = Array.isArray(models) ? models.slice() : [];
    const index = list.findIndex(item => item && item.id === currentModel);
    if (index > 0) {
        const [current] = list.splice(index, 1);
        list.unshift(current);
    }

    const choices = list
        .filter(item => item && item.id)
        .map(item => ({
            title: item.id === currentModel
                ? `${item.label} (${item.id}) (${process.stdout.isTTY ? `${ANSI.yellow}当前模型${ANSI.reset}` : '当前模型'})`
                : `${item.label} (${item.id})`,
            value: item.id
        }));

    choices.push({
        title: '手动输入 model',
        value: '__manual__'
    });
    return choices;
}

async function commandCurrent(options = {}) {
    const ctx = getRuntimeContext();
    return output({
        selectedPath: ctx.discovery.selected,
        candidates: ctx.discovery.candidates,
        existing: ctx.discovery.existing,
        current: ctx.summary
    }, options.json);
}

async function commandModes(options = {}) {
    const ctx = getRuntimeContext();
    const providerId = options.provider || ctx.summary.model_provider;

    const result = await getModesAndModels({
        codexConfig: ctx.configData,
        providerId,
        selectedMode: options.mode,
        endpoints: ctx.runtime.api.endpoints,
        ttlMs: ctx.runtime.cache.ttlMs,
        forceRefresh: !!options.refresh
    });

    return output({
        providerId,
        source: result.source,
        warning: result.warning,
        modes: result.modes,
        models: result.models
    }, options.json);
}

async function resolveSwitchInput(ctx, options = {}) {
    const currentProviderId = ctx.summary.model_provider;
    const requestedProvider = options.provider || currentProviderId;

    const selectedMode = options.interactive ? null : (options.mode || null);
    let selectedModel = normalizeModelValue(options.model);
    let providerId = requestedProvider;

    const remote = await getModesAndModels({
        codexConfig: ctx.configData,
        providerId,
        selectedMode,
        endpoints: ctx.runtime.api.endpoints,
        ttlMs: ctx.runtime.cache.ttlMs,
        forceRefresh: !!options.interactive
    });

    if (!selectedModel && !options.interactive) {
        throw new Error('Missing --model for non-interactive use command');
    }

    if (options.interactive) {
        const currentModel = ctx.summary.model || '';
        const models = Array.isArray(remote.models) ? remote.models.slice() : [];
        const canSelectFromList = models.length > 0;

        if (canSelectFromList) {
            const modelResp = await prompts({
                type: 'autocomplete',
                name: 'value',
                message: currentModel
                    ? `选择模型（当前: ${currentModel}）`
                    : '选择模型',
                choices: buildInteractiveModelChoices(models, currentModel),
                suggest: (input, choices) => {
                    const key = String(input || '').trim().toLowerCase();
                    if (!key) {
                        return choices;
                    }
                    return choices.filter(choice => String(choice.title || '').toLowerCase().includes(key));
                }
            });

            if (!Object.prototype.hasOwnProperty.call(modelResp, 'value')) {
                return {cancelled: true};
            }

            if (modelResp.value === '__manual__') {
                const manualResp = await prompts({
                    type: 'text',
                    name: 'value',
                    message: currentModel
                        ? `请输入模型 ID（当前: ${currentModel}）`
                        : '请输入模型 ID'
                });
                if (!Object.prototype.hasOwnProperty.call(manualResp, 'value')) {
                    return {cancelled: true};
                }
                selectedModel = normalizeModelValue(manualResp.value);
            } else {
                selectedModel = normalizeModelValue(modelResp.value);
            }
        } else {
            const manualResp = await prompts({
                type: 'text',
                name: 'value',
                message: currentModel
                    ? `未拉取到模型列表，请手动输入模型 ID（当前: ${currentModel}）`
                    : '未拉取到模型列表，请手动输入模型 ID'
            });
            if (!Object.prototype.hasOwnProperty.call(manualResp, 'value')) {
                return {cancelled: true};
            }
            selectedModel = normalizeModelValue(manualResp.value);
        }
    }

    if (!selectedModel) {
        throw new Error('Model is required');
    }

    if (remote.models.length > 0) {
        const picked = remote.models.find(item => item.id === selectedModel);
        if (picked && picked.providerId) {
            providerId = picked.providerId;
        }
    }

    return {
        providerId,
        mode: selectedMode,
        model: selectedModel,
        source: remote.source,
        warning: remote.warning
    };
}

async function commandUse(options = {}) {
    const ctx = getRuntimeContext();
    const selection = await resolveSwitchInput(ctx, options);
    if (selection.cancelled) {
        return output({
            success: false,
            cancelled: true
        }, options.json);
    }

    const before = summarizeConfig(ctx.configPath, ctx.configData);
    const nextModel = normalizeModelValue(selection.model);
    const isNoop = before.model_provider === selection.providerId && before.model === nextModel;
    if (isNoop) {
        return output({
            success: true,
            changed: false,
            source: selection.source,
            warning: selection.warning,
            modelChange: `${before.model} -> ${before.model}`,
            diff: [],
            current: before,
            message: '模型未变化，已跳过写入'
        }, options.json);
    }

    const targetProvider = getProviderNode(ctx.configData, selection.providerId);
    const currentProvider = getProviderNode(ctx.configData, ctx.summary.model_provider);
    const next = makeConfigPatch(ctx.configData, {
        providerId: selection.providerId,
        model: nextModel,
        baseUrl: targetProvider && targetProvider.base_url
            ? targetProvider.base_url
            : (currentProvider && currentProvider.base_url ? currentProvider.base_url : ''),
        httpHeaders: targetProvider && targetProvider.http_headers
            ? targetProvider.http_headers
            : (currentProvider && currentProvider.http_headers ? currentProvider.http_headers : {})
    });

    const after = summarizeConfig(ctx.configPath, next);
    const diffLines = buildDiff(before, after);
    const modelChange = `${before.model} -> ${after.model}`;

    if (!options.yes) {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: `确认更新模型吗？\nprovider: ${before.model_provider} -> ${after.model_provider}\nmodel: ${before.model} -> ${after.model}`,
            initial: true
        });
        if (!confirm.ok) {
            return output({
                success: false,
                cancelled: true,
                diff: diffLines
            }, options.json);
        }
    }

    const backup = createBackup(ctx.configPath, ctx.runtime.backup.maxFiles);

    try {
        writeConfigAtomic(ctx.configPath, next);
        return output({
            success: true,
            changed: true,
            backup,
            source: selection.source,
            warning: selection.warning,
            modelChange,
            diff: diffLines,
            current: after
        }, options.json);
    } catch (error) {
        restoreBackup(ctx.configPath, backup.id);
        throw error;
    }
}

async function commandBackupList(options = {}) {
    const backups = listBackups();
    return output({
        total: backups.length,
        items: backups
    }, options.json);
}

async function commandRollback(options = {}) {
    const ctx = getRuntimeContext();
    const backups = listBackups();
    if (backups.length === 0) {
        throw new Error('No backup found');
    }

    let targetId = options.id || backups[0].id;

    if (options.interactive && !options.id) {
        const response = await prompts({
            type: 'select',
            name: 'id',
            message: 'Select backup to rollback',
            choices: backups.map(item => ({title: `${item.id} (${item.mtime})`, value: item.id}))
        });
        if (!response.id) {
            return output({success: false, cancelled: true}, options.json);
        }
        targetId = response.id;
    }

    if (!options.yes) {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: `Rollback using backup ${targetId}?`,
            initial: false
        });
        if (!confirm.ok) {
            return output({success: false, cancelled: true}, options.json);
        }
    }

    restoreBackup(ctx.configPath, targetId);
    const latest = summarizeConfig(ctx.configPath, readCodexConfig(ctx.configPath).data);

    return output({
        success: true,
        id: targetId,
        current: latest
    }, options.json);
}

async function commandCleanCache(options = {}) {
    const discovery = requireCodexConfigPath();
    const codexHome = discovery.codexHome;
    const sessionsDays = Number(options.sessionsDays || 7);
    const dryRun = !!options.dryRun;

    const plan = collectCleanupPlan(codexHome, sessionsDays);
    const summary = summarizePlan(plan);

    if (!dryRun && !options.yes) {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: `Delete ${summary.fileCount} files (${summary.totalBytes} bytes)?`,
            initial: false
        });
        if (!confirm.ok) {
            return output({success: false, cancelled: true, dryRun: false, summary}, options.json);
        }
    }

    const executed = executePlan(plan, dryRun);

    return output({
        success: true,
        dryRun,
        sessionsDays,
        plan: plan.map(item => ({kind: item.kind, path: item.path, count: (item.entries || []).length})),
        result: executed
    }, options.json);
}

function resolveCodexHomeForEdit() {
    if (process.env.CODEX_HOME && String(process.env.CODEX_HOME).trim()) {
        return path.resolve(process.env.CODEX_HOME);
    }

    const discovery = discoverCodexConfig();
    if (discovery.codexHome) {
        return discovery.codexHome;
    }

    if (Array.isArray(discovery.candidates) && discovery.candidates.length > 0) {
        return path.dirname(discovery.candidates[0]);
    }

    return path.join(process.env.HOME || '.', '.codex');
}

function resolveEditDefaults(configPath, authPath) {
    let baseUrl = DEFAULT_BASE_URL;
    if (fs.existsSync(configPath)) {
        try {
            const parsed = readCodexConfig(configPath).data;
            const provider = getProviderNode(parsed, MANAGED_PROVIDER_ID);
            if (provider && provider.base_url) {
                baseUrl = String(provider.base_url).trim() || baseUrl;
            }
        } catch (error) {
            // ignore invalid config, fallback to defaults
        }
    }

    const authKey = readAuthKey(authPath) || DEFAULT_API_KEY;
    return {baseUrl, authKey};
}

function buildManagedConfigData(configPath, baseUrl) {
    let nextData = {};
    if (fs.existsSync(configPath)) {
        try {
            nextData = readCodexConfig(configPath).data;
        } catch (error) {
            nextData = {};
        }
    }

    const next = {...nextData};
    next.model_provider = MANAGED_PROVIDER_ID;
    next.model = MANAGED_MODEL;
    if (!next.model_providers || typeof next.model_providers !== 'object') {
        next.model_providers = {};
    }

    const currentProvider = next.model_providers[MANAGED_PROVIDER_ID];
    const httpHeaders = currentProvider && typeof currentProvider.http_headers === 'object'
        ? currentProvider.http_headers
        : {};

    next.model_providers[MANAGED_PROVIDER_ID] = {
        name: MANAGED_PROVIDER_NAME,
        base_url: baseUrl,
        wire_api: MANAGED_WIRE_API,
        http_headers: httpHeaders
    };

    return next;
}

async function commandEditConfig(options = {}) {
    const codexHome = resolveCodexHomeForEdit();
    const configPath = path.join(codexHome, 'config.toml');
    const authPath = path.join(codexHome, 'auth.json');
    const defaults = resolveEditDefaults(configPath, authPath);
    let baseUrl = String(options.url || defaults.baseUrl || '').trim();
    let apiKey = String(options.key || defaults.authKey || '').trim();

    if (options.interactive) {
        const urlResp = await prompts({
            type: 'text',
            name: 'value',
            message: `编辑 base_url（当前: ${defaults.baseUrl}）`,
            initial: defaults.baseUrl,
            validate: value => {
                const text = String(value || '').trim();
                if (!text) {
                    return 'base_url 不能为空';
                }
                if (!/^https?:\/\//i.test(text)) {
                    return 'base_url 必须以 http:// 或 https:// 开头';
                }
                return true;
            }
        });
        if (!Object.prototype.hasOwnProperty.call(urlResp, 'value')) {
            return output({success: false, cancelled: true, configPath, authPath}, options.json);
        }
        baseUrl = String(urlResp.value || '').trim();

        const keyResp = await prompts({
            type: 'text',
            name: 'value',
            message: `编辑 OPENAI_API_KEY（当前: ${maskKey(defaults.authKey)}）`,
            initial: defaults.authKey,
            validate: value => String(value || '').trim() ? true : 'OPENAI_API_KEY 不能为空'
        });
        if (!Object.prototype.hasOwnProperty.call(keyResp, 'value')) {
            return output({success: false, cancelled: true, configPath, authPath}, options.json);
        }
        apiKey = String(keyResp.value || '').trim();
    }

    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
        throw new Error('Invalid base_url, expected http:// or https://');
    }
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required');
    }

    if (!options.yes) {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: `确认写入配置吗？\nconfig: ${configPath}\nauth: ${authPath}\nbase_url: ${baseUrl}\nkey: ${maskKey(apiKey)}`,
            initial: true
        });
        if (!confirm.ok) {
            return output({success: false, cancelled: true, configPath, authPath}, options.json);
        }
    }

    fs.mkdirSync(codexHome, {recursive: true});
    const nextConfig = buildManagedConfigData(configPath, baseUrl);
    writeConfigAtomic(configPath, nextConfig);
    fs.writeFileSync(authPath, JSON.stringify({OPENAI_API_KEY: apiKey}, null, 2) + '\n', 'utf8');

    const summary = summarizeConfig(configPath, readCodexConfig(configPath).data);
    return output({
        success: true,
        configPath,
        authPath,
        keyMasked: maskKey(apiKey),
        current: summary
    }, options.json);
}

module.exports = {
    getRuntimeContext,
    commandCurrent,
    commandModes,
    commandUse,
    commandBackupList,
    commandRollback,
    commandCleanCache,
    commandEditConfig
};
