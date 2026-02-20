const {upsertProviderCache, getProviderCache} = require('./cache-store');

function trimSlash(url) {
    return String(url || '').replace(/\/+$/, '');
}

function buildUrl(baseUrl, endpoint, query) {
    const root = trimSlash(baseUrl);
    let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // base_url 已含版本段时，避免和 endpoint 的同版本段重复（/v1 + /v1/models => /v1/models）
    const baseVersionMatch = root.match(/\/(v\d+)$/i);
    const endpointVersionMatch = normalizedEndpoint.match(/^\/(v\d+)(\/|$)/i);
    if (baseVersionMatch && endpointVersionMatch && baseVersionMatch[1].toLowerCase() === endpointVersionMatch[1].toLowerCase()) {
        normalizedEndpoint = normalizedEndpoint.slice(endpointVersionMatch[1].length + 1);
        if (!normalizedEndpoint.startsWith('/')) {
            normalizedEndpoint = `/${normalizedEndpoint}`;
        }
    }

    const url = new URL(`${root}${normalizedEndpoint}`);

    if (query && typeof query === 'object') {
        for (const key of Object.keys(query)) {
            if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
                url.searchParams.set(key, query[key]);
            }
        }
    }

    return url.toString();
}

function normalizeModes(payload, providerId) {
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload && payload.data)
            ? payload.data
            : Array.isArray(payload && payload.modes)
                ? payload.modes
                : [];

    return list
        .map(item => {
            if (typeof item === 'string') {
                return {
                    id: item,
                    label: item,
                    providerId,
                    raw: item
                };
            }

            if (!item || typeof item !== 'object') {
                return null;
            }

            const id = item.id || item.mode || item.name;
            if (!id) {
                return null;
            }

            return {
                id,
                label: item.label || item.name || id,
                providerId: item.providerId || item.provider || providerId,
                raw: item
            };
        })
        .filter(Boolean);
}

function normalizeModels(payload, providerId, fallbackModeId) {
    const output = [];
    const seen = new Set();

    function pushModel(item, modeHint) {
        if (typeof item === 'string') {
            if (!seen.has(item)) {
                output.push({
                    id: item,
                    label: item,
                    modeId: modeHint || fallbackModeId || null,
                    providerId,
                    raw: item
                });
                seen.add(item);
            }
            return;
        }

        if (!item || typeof item !== 'object') {
            return;
        }

        const id = item.id || item.model || item.name;
        if (!id || seen.has(id)) {
            return;
        }

        output.push({
            id,
            label: item.label || item.name || id,
            modeId: item.modeId || item.mode || modeHint || fallbackModeId || null,
            providerId: item.providerId || item.provider || providerId,
            raw: item
        });
        seen.add(id);
    }

    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload && payload.data)
            ? payload.data
            : Array.isArray(payload && payload.models)
                ? payload.models
                : null;

    if (Array.isArray(list)) {
        list.forEach(item => pushModel(item, null));
        return output;
    }

    const grouped = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload && typeof payload === 'object' && payload.models && typeof payload.models === 'object'
            ? payload.models
            : null;

    if (grouped && typeof grouped === 'object') {
        for (const key of Object.keys(grouped)) {
            const items = grouped[key];
            if (Array.isArray(items)) {
                items.forEach(item => pushModel(item, key));
            } else {
                pushModel(items, key);
            }
        }
    }

    return output;
}

function toEndpointList(value, fallbackList) {
    const list = Array.isArray(value)
        ? value
        : (typeof value === 'string' && value.trim() ? [value] : fallbackList);

    const output = [];
    for (const item of list) {
        const text = String(item || '').trim();
        if (!text || output.includes(text)) {
            continue;
        }
        output.push(text);
    }
    return output;
}

function normalizeRequestHeaders(headers) {
    const output = {};
    const source = headers && typeof headers === 'object' ? headers : {};

    // fetch 会遍历对象 own keys；这里显式只保留可枚举字符串键，避免 Symbol 键导致 ByteString 异常
    for (const key of Object.keys(source)) {
        const value = source[key];
        if (value === undefined || value === null) {
            continue;
        }
        output[String(key)] = String(value);
    }

    return output;
}

async function requestJson(url, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal
        });

        const text = await response.text();
        let body = {};
        try {
            body = text ? JSON.parse(text) : {};
        } catch (error) {
            body = {};
        }

        if (!response.ok) {
            const msg = body && body.error && body.error.message
                ? body.error.message
                : `HTTP ${response.status}`;
            throw new Error(msg);
        }

        return body;
    } finally {
        clearTimeout(timer);
    }
}

async function requestByCandidates(baseUrl, endpoints, headers, query) {
    let lastError = null;
    for (const endpoint of endpoints) {
        try {
            const payload = await requestJson(buildUrl(baseUrl, endpoint, query), headers);
            return {endpoint, payload};
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('request failed');
}

async function getModesAndModels(options) {
    const {
        codexConfig,
        providerId,
        selectedMode,
        endpoints,
        ttlMs,
        forceRefresh
    } = options;

    const {getProviderNode} = require('./codex-config');
    const provider = getProviderNode(codexConfig, providerId);
    if (!provider || !provider.base_url) {
        throw new Error(`Provider missing or no base_url: ${providerId}`);
    }

    const headers = normalizeRequestHeaders(provider.http_headers);

    const modeEndpoints = toEndpointList(endpoints && endpoints.modes, ['/modes', '/v1/modes']);
    const modelEndpoints = ['/v1/models'];

    if (!forceRefresh) {
        const hit = getProviderCache(providerId, ttlMs);
        if (hit) {
            return {
                source: 'cache',
                modes: hit.modes || [],
                models: hit.models || [],
                warning: null
            };
        }
    }

    try {
        let modeItems = [];
        const modeId = selectedMode || null;
        let modeWarning = null;

        try {
            const modesPayload = await requestByCandidates(provider.base_url, modeEndpoints, headers, null);
            modeItems = normalizeModes(modesPayload.payload, providerId);
        } catch (error) {
            modeWarning = error.message || 'modes fetch failed';
        }

        let modelsPayload = null;
        modelsPayload = await requestByCandidates(provider.base_url, modelEndpoints, headers, null);

        const modelItems = normalizeModels(modelsPayload.payload, providerId, modeId);

        upsertProviderCache(providerId, {
            modes: modeItems,
            models: modelItems
        });

        return {
            source: 'remote',
            modes: modeItems,
            models: modelItems,
            warning: modeWarning
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
    normalizeModes,
    normalizeModels,
    buildUrl,
    toEndpointList,
    normalizeRequestHeaders
};
