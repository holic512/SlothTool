const os = require('os');
const path = require('path');
const fs = require('fs');

function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

function getSystemdConfigPath() {
    return path.join(getPluginConfigsDir(), 'systemd.json');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

function getDefaultConfig() {
    return {
        logLines: 200,
        confirmDangerous: true,
        historyLimits: {
            services: 20,
            actions: 50,
            searches: 20
        }
    };
}

function readConfig() {
    const configPath = getSystemdConfigPath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content);
        const defaultConfig = getDefaultConfig();
        return {
            logLines: config.logLines ?? defaultConfig.logLines,
            confirmDangerous: config.confirmDangerous ?? defaultConfig.confirmDangerous,
            historyLimits: {
                ...defaultConfig.historyLimits,
                ...(config.historyLimits || {})
            }
        };
    } catch (error) {
        console.error('Failed to read config:', error.message);
        return getDefaultConfig();
    }
}

function writeConfig(config) {
    const configPath = getSystemdConfigPath();
    ensureDir(getPluginConfigsDir());

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to write config:', error.message);
        throw error;
    }
}

module.exports = {
    getDefaultConfig,
    readConfig,
    writeConfig
};
