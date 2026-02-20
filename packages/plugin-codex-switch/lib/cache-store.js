const fs = require('fs');
const {ensureDir, getPluginConfigsDir, getPluginCachePath} = require('./config-paths');

function readCache() {
    const cachePath = getPluginCachePath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(cachePath)) {
        return {
            updatedAt: 0,
            providers: {}
        };
    }

    try {
        const content = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(content);
        return {
            updatedAt: Number(parsed.updatedAt || 0),
            providers: parsed.providers && typeof parsed.providers === 'object' ? parsed.providers : {}
        };
    } catch (error) {
        return {
            updatedAt: 0,
            providers: {}
        };
    }
}

function writeCache(cache) {
    ensureDir(getPluginConfigsDir());
    const cachePath = getPluginCachePath();
    const output = {
        updatedAt: Date.now(),
        providers: cache.providers || {}
    };
    fs.writeFileSync(cachePath, JSON.stringify(output, null, 2), 'utf8');
    return output;
}

function upsertProviderCache(providerId, entry) {
    const cache = readCache();
    cache.providers[providerId] = {
        ...entry,
        updatedAt: Date.now()
    };
    return writeCache(cache);
}

function getProviderCache(providerId, ttlMs) {
    const cache = readCache();
    const item = cache.providers[providerId];
    if (!item) {
        return null;
    }

    if (!ttlMs || ttlMs <= 0) {
        return item;
    }

    const age = Date.now() - Number(item.updatedAt || 0);
    if (age > ttlMs) {
        return null;
    }

    return item;
}

module.exports = {
    readCache,
    writeCache,
    upsertProviderCache,
    getProviderCache
};
