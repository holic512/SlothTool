const {upsertProviderCache, getProviderCache} = require('./cache-store');
const {getProviderNode} = require('./codex-config');
const {discoverCodexConfig} = require('./config-paths');
const fs = require('fs');
const path = require('path');

function trimSlash(url) {
    return String(url || '').replace(/\/+$/, '');
}

function withBearerPrefix(token) {
    const text = String(token || '').trim();
    if (!text) {
        return '';
    }
    return /^Bearer\s+/i.test(text) ? text : `Bearer ${text}`;
}

function readAuthKeyFromCodex() {
    const discovery = discoverCodexConfig();
    const codexHome = discovery && discovery.codexHome ? discovery.codexHome : null;
    if (!codexHome) {
        throw new Error('Codex home not found');
    }

    const authPath = path.join(codexHome, 'auth.json');
    if (!fs.existsSync(authPath)) {
        throw new Error(`auth.json not found: ${authPath}`);
    }

    let parsed = null;
    try {
        parsed = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    } catch (error) {
        throw new Error(`auth.json parse failed: ${authPath}`);
    }

    const key = parsed && typeof parsed === 'object'
        ? String(parsed.OPENAI_API_KEY || '').trim()
        : '';
    if (!key) {
        throw new Error(`OPENAI_API_KEY missing in auth.json: ${authPath}`);
    }

    return key;
}

function resolveTransportConfig(provider, authKey) {
    const target = provider || {};
    return {
        url: String(target.base_url || target.url || '').trim(),
        key: String(authKey || '').trim(),
        headers: target.http_headers && typeof target.http_headers === 'object' ? target.http_headers : {}
    };
}

function buildModelsUrl(transport) {
    const baseUrl = String(transport && transport.url || '').trim();
    if (!baseUrl) {
        return '';
    }
    return `${trimSlash(baseUrl)}/models`;
}

function buildRequestHeaders(transport) {
    const keyAuthorization = withBearerPrefix(transport && transport.key);
    const authorization = String(keyAuthorization || '').trim();
    if (!authorization) {
        return {};
    }

    return {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Authorization: authorization,
        Connection: 'close'
    };
}

function toHeaderObject(headers) {
    const output = {};
    if (!headers || typeof headers.entries !== 'function') {
        return output;
    }
    for (const [key, value] of headers.entries()) {
        output[key] = value;
    }
    return output;
}

function stringifySafe(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
}

function buildRequestLogMessage(url, reason, debugLog) {
    return `request ${url} failed: ${reason}\n[request-log]\n${stringifySafe(debugLog)}`;
}

function normalizeModels(payload, providerId) {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload && payload.data)
            ? payload.data
            : [];

    return list
        .map(item => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            const id = item.id || item.model || item.name;
            if (!id) {
                return null;
            }

            return {
                id,
                label: item.label || item.name || id,
                modeId: null,
                providerId,
                raw: item
            };
        })
        .filter(Boolean);
}

async function requestModels(transport, headers) {
    const url = buildModelsUrl(transport);
    if (!url) {
        throw new Error('Provider missing url/base_url');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const debugLog = {
        request: {
            method: 'GET',
            url,
            headers: {...headers}
        },
        response: null
    };

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal
        });

        const text = await response.text();
        debugLog.response = {
            status: response.status,
            statusText: response.statusText,
            headers: toHeaderObject(response.headers),
            body: text
        };

        let body = {};
        try {
            body = text ? JSON.parse(text) : {};
        } catch (error) {
            body = {};
        }

        if (!response.ok) {
            const message = body && body.error && body.error.message
                ? body.error.message
                : `HTTP ${response.status}`;
            throw new Error(buildRequestLogMessage(url, message, debugLog));
        }

        return body;
    } catch (error) {
        const reason = error && error.message ? error.message : 'fetch failed';
        if (reason.includes('[request-log]')) {
            throw error;
        }
        throw new Error(buildRequestLogMessage(url, reason, debugLog));
    } finally {
        clearTimeout(timer);
    }
}

async function getModesAndModels(options) {
    const {
        codexConfig,
        providerId,
        ttlMs,
        forceRefresh
    } = options;

    const provider = getProviderNode(codexConfig, providerId);
    if (!provider) {
        throw new Error(`Provider missing: ${providerId}`);
    }
    const authKey = readAuthKeyFromCodex();
    const transport = resolveTransportConfig(provider, authKey);

    if (!forceRefresh) {
        const hit = getProviderCache(providerId, ttlMs);
        if (hit && Array.isArray(hit.models) && hit.models.length > 0) {
            return {
                source: 'cache',
                modes: hit.modes || [],
                models: hit.models || [],
                warning: null
            };
        }
    }

    try {
        const headers = buildRequestHeaders(transport);
        const payload = await requestModels(transport, headers);
        const models = normalizeModels(payload, providerId);

        upsertProviderCache(providerId, {
            modes: [],
            models
        });

        return {
            source: 'remote',
            modes: [],
            models,
            warning: null
        };
    } catch (error) {
        const hit = getProviderCache(providerId, 0);
        if (hit) {
            return {
                source: 'cache',
                modes: hit.modes || [],
                models: hit.models || [],
                warning: error.message || 'remote fetch failed'
            };
        }

        return {
            source: 'manual',
            modes: [],
            models: [],
            warning: error.message || 'remote fetch failed'
        };
    }
}

module.exports = {
    getModesAndModels,
    buildRequestHeaders,
    buildModelsUrl,
    normalizeModels
};
