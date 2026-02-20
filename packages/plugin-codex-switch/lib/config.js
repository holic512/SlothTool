const fs = require('fs');
const {ensureDir, getPluginConfigsDir, getPluginConfigPath} = require('./config-paths');

function getDefaultConfig() {
    return {
        language: 'zh',
        api: {
            endpoints: {
                modes: ['/modes', '/v1/modes'],
                models: ['/models', '/v1/models', '/api/models']
            }
        },
        cache: {
            ttlMs: 300000
        },
        backup: {
            maxFiles: 30
        }
    };
}

function readConfig() {
    const filePath = getPluginConfigPath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(filePath)) {
        return getDefaultConfig();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const defaults = getDefaultConfig();
        const parsedModes = parsed.api && parsed.api.endpoints && parsed.api.endpoints.modes;
        const parsedModels = parsed.api && parsed.api.endpoints && parsed.api.endpoints.models;

        const normalizeEndpoint = (value, fallback) => {
            if (Array.isArray(value)) {
                const list = value
                    .map(item => String(item || '').trim())
                    .filter(Boolean);
                return list.length > 0 ? list : fallback;
            }
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
            return fallback;
        };

        return {
            language: parsed.language || defaults.language,
            api: {
                endpoints: {
                    modes: normalizeEndpoint(parsedModes, defaults.api.endpoints.modes),
                    models: normalizeEndpoint(parsedModels, defaults.api.endpoints.models)
                }
            },
            cache: {
                ttlMs: Number(parsed.cache && parsed.cache.ttlMs) || defaults.cache.ttlMs
            },
            backup: {
                maxFiles: Number(parsed.backup && parsed.backup.maxFiles) || defaults.backup.maxFiles
            }
        };
    } catch (error) {
        return getDefaultConfig();
    }
}

function writeConfig(config) {
    ensureDir(getPluginConfigsDir());
    const merged = {...getDefaultConfig(), ...config};
    fs.writeFileSync(getPluginConfigPath(), JSON.stringify(merged, null, 2), 'utf8');
    return merged;
}

module.exports = {
    getDefaultConfig,
    readConfig,
    writeConfig
};
