const os = require('os');
const path = require('path');
const fs = require('fs');

function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

function getConfigPath(pluginName) {
    return path.join(getPluginConfigsDir(), `${pluginName}.json`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

function getDefaultConfig() {
    return {
        sampleOption: true
    };
}

function readConfig(pluginName) {
    const configPath = getConfigPath(pluginName);
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content);
        const defaultConfig = getDefaultConfig();
        return {
            ...defaultConfig,
            ...config
        };
    } catch (error) {
        return getDefaultConfig();
    }
}

function writeConfig(pluginName, config) {
    const configPath = getConfigPath(pluginName);
    ensureDir(getPluginConfigsDir());
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
    getDefaultConfig,
    readConfig,
    writeConfig
};
