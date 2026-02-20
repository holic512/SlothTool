const {upsertProviderCache, getProviderCache} = require('./cache-store');
const {getProviderNode} = require('./codex-config');

function trimSlash(url) {
    return String(url || '').replace(/\/+$/, '');
}

function buildUrl(baseUrl, endpoint, query) {
    const root = trimSlash(baseUrl);
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
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
    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload && payload.data)
            ? payload.data
            : Array.isArray(payload && payload.models)
                ? payload.models
                : [];

    return list
        .map(item => {
            if (typeof item === 'string') {
                return {
                    id: item,
                    label: item,
                    modeId: fallbackModeId || null,
                    providerId,
                    raw: item
                };
            }

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
                modeId: item.modeId || item.mode || fallbackModeId || null,
                providerId: item.providerId || item.provider || providerId,
                raw: item
            };
        })
        .filter(Boolean);
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

async function getModesAndModels(options) {
    const {
        codexConfig,
        providerId,
        selectedMode,
        endpoints,
        ttlMs,
        forceRefresh
    } = options;

    const provider = getProviderNode(codexConfig, providerId);
    if (!provider || !provider.base_url) {
        throw new Error(`Provider missing or no base_url: ${providerId}`);
    }

    const headers = provider.http_headers && typeof provider.http_headers === 'object'
        ? provider.http_headers
        : {};

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
        const modesPayload = await requestJson(
            buildUrl(provider.base_url, endpoints.modes),
            headers
        );

        const modeItems = normalizeModes(modesPayload, providerId);
        const modeId = selectedMode || (modeItems[0] ? modeItems[0].id : undefined);

        const modelsPayload = await requestJson(
            buildUrl(provider.base_url, endpoints.models, {mode: modeId}),
            headers
        );

        const modelItems = normalizeModels(modelsPayload, providerId, modeId);

        upsertProviderCache(providerId, {
            modes: modeItems,
            models: modelItems
        });

        return {
            source: 'remote',
            modes: modeItems,
            models: modelItems,
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
    normalizeModes,
    normalizeModels,
    buildUrl
};
