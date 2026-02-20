const fs = require('fs');
const {ensureDir, getPluginConfigsDir, getPluginConfigPath} = require('./config-paths');

function getDefaultConfig() {
    return {
        language: 'zh',
        api: {
            endpoints: {
                modes: '/modes',
                models: '/models'
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
        return {
            language: parsed.language || defaults.language,
            api: {
                endpoints: {
                    modes: parsed.api && parsed.api.endpoints && parsed.api.endpoints.modes || defaults.api.endpoints.modes,
                    models: parsed.api && parsed.api.endpoints && parsed.api.endpoints.models || defaults.api.endpoints.models
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
