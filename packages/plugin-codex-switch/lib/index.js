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
    let selectedModel = options.model || null;
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
        if (remote.source !== 'manual' && remote.models.length > 0) {
            const currentModel = ctx.summary.model || '';
            const models = remote.models.slice();
            const currentIndex = models.findIndex(item => item.id === currentModel);
            if (currentIndex > 0) {
                const [currentItem] = models.splice(currentIndex, 1);
                models.unshift(currentItem);
            }

            const modelChoices = models.map(item => ({
                title: item.id === currentModel
                    ? `${item.label} (${item.id}) (当前)`
                    : `${item.label} (${item.id})`,
                value: item.id
            }));

            const modelResp = await prompts({
                type: 'autocompleteMultiselect',
                name: 'value',
                message: currentModel
                    ? `选择模型（当前: ${currentModel}，空格选择，回车确认）`
                    : '选择模型（空格选择，回车确认）',
                choices: modelChoices,
                min: 1,
                max: 1,
                instructions: false,
                hint: '输入关键字筛选'
            });

            const selected = Array.isArray(modelResp.value) ? modelResp.value[0] : null;
            selectedModel = selected || selectedModel;

            const picked = models.find(item => item.id === selectedModel);
            if (picked && picked.providerId) {
                providerId = picked.providerId;
            }
        } else {
            throw new Error(remote.warning || '无法从远端获取模型列表');
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

    const before = summarizeConfig(ctx.configPath, ctx.configData);

    const targetProvider = getProviderNode(ctx.configData, selection.providerId);
    const currentProvider = getProviderNode(ctx.configData, ctx.summary.model_provider);
    const next = makeConfigPatch(ctx.configData, {
        providerId: selection.providerId,
        model: selection.model,
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
            message: `确认更新模型为 ${selection.model} 吗？`,
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

async function commandDoctor(options = {}) {
    const discovery = discoverCodexConfig();
    const report = {
        selectedPath: discovery.selected,
        candidates: discovery.candidates,
        existing: discovery.existing,
        warnings: [],
        checks: {}
    };

    if (!discovery.selected) {
        report.warnings.push('Codex config not found');
        return output(report, options.json);
    }

    try {
        const read = readCodexConfig(discovery.selected);
        const summary = summarizeConfig(discovery.selected, read.data);

        report.checks.parse = true;
        report.checks.model_provider = !!summary.model_provider;
        report.checks.model = !!summary.model;
        report.checks.base_url = !!summary.provider.base_url;
        report.current = summary;

        if (!report.checks.model_provider) report.warnings.push('model_provider missing');
        if (!report.checks.model) report.warnings.push('model missing');
        if (!report.checks.base_url) report.warnings.push('provider.base_url missing');

        const runtime = pluginConfig.readConfig();
        const modes = await getModesAndModels({
            codexConfig: read.data,
            providerId: summary.model_provider,
            selectedMode: null,
            endpoints: runtime.api.endpoints,
            ttlMs: runtime.cache.ttlMs,
            forceRefresh: false
        });

        report.checks.modesSource = modes.source;
        report.checks.modesCount = modes.modes.length;
        report.checks.modelsCount = modes.models.length;
        if (modes.warning) {
            report.warnings.push(`modes warning: ${modes.warning}`);
        }
    } catch (error) {
        report.checks.parse = false;
        report.warnings.push(error.message);
    }

    return output(report, options.json);
}

module.exports = {
    getRuntimeContext,
    commandCurrent,
    commandModes,
    commandUse,
    commandBackupList,
    commandRollback,
    commandCleanCache,
    commandDoctor
};
