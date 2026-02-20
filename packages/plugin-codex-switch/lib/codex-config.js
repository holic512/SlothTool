const fs = require('fs');
const TOML = require('@iarna/toml');

function maskValue(value) {
    if (typeof value !== 'string') {
        return value;
    }

    if (value.length <= 8) {
        return '***';
    }

    return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function readCodexConfig(configPath) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const data = TOML.parse(raw);
    return {raw, data};
}

function safeHeaders(headers) {
    const output = {};
    const src = headers && typeof headers === 'object' ? headers : {};
    for (const key of Object.keys(src)) {
        const lower = key.toLowerCase();
        if (lower.includes('authorization') || lower.includes('token') || lower.includes('api-key') || lower.includes('api_key')) {
            output[key] = maskValue(src[key]);
        } else {
            output[key] = src[key];
        }
    }
    return output;
}

function getProviderNode(config, providerId) {
    const providers = config.model_providers && typeof config.model_providers === 'object'
        ? config.model_providers
        : {};
    return providers[providerId] || null;
}

function summarizeConfig(configPath, data) {
    const modelProvider = data.model_provider || '';
    const model = data.model || '';
    const providerNode = getProviderNode(data, modelProvider) || {};
    return {
        configPath,
        model_provider: modelProvider,
        model,
        provider: {
            id: modelProvider,
            name: providerNode.name || '',
            base_url: providerNode.base_url || '',
            wire_api: providerNode.wire_api || '',
            http_headers: safeHeaders(providerNode.http_headers || {})
        }
    };
}

function makeConfigPatch(data, input) {
    const next = {...data};
    next.model_provider = input.providerId;
    next.model = input.model;

    if (!next.model_providers || typeof next.model_providers !== 'object') {
        next.model_providers = {};
    }

    if (!next.model_providers[input.providerId]) {
        next.model_providers[input.providerId] = {
            name: input.providerId,
            base_url: input.baseUrl || '',
            wire_api: 'responses',
            http_headers: input.httpHeaders || {}
        };
    }

    return next;
}

function buildDiff(beforeSummary, afterSummary) {
    const lines = [];
    if (beforeSummary.model_provider !== afterSummary.model_provider) {
        lines.push(`model_provider: ${beforeSummary.model_provider} -> ${afterSummary.model_provider}`);
    }
    if (beforeSummary.model !== afterSummary.model) {
        lines.push(`model: ${beforeSummary.model} -> ${afterSummary.model}`);
    }
    if (beforeSummary.provider.base_url !== afterSummary.provider.base_url) {
        lines.push(`base_url: ${beforeSummary.provider.base_url} -> ${afterSummary.provider.base_url}`);
    }
    return lines;
}

function writeConfigAtomic(configPath, nextData) {
    const tempPath = `${configPath}.${Date.now()}.tmp`;
    const content = TOML.stringify(nextData);
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, configPath);
}

module.exports = {
    readCodexConfig,
    summarizeConfig,
    makeConfigPatch,
    buildDiff,
    writeConfigAtomic,
    getProviderNode,
    safeHeaders
};
