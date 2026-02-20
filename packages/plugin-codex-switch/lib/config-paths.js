const os = require('os');
const path = require('path');
const fs = require('fs');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

function getPluginConfigPath() {
    return path.join(getPluginConfigsDir(), 'codex-switch.json');
}

function getPluginCachePath() {
    return path.join(getPluginConfigsDir(), 'codex-switch.cache.json');
}

function getBackupDir() {
    return path.join(getPluginConfigsDir(), 'codex-switch.backups');
}

function getCodexHomeCandidates() {
    const homes = [];

    if (process.env.CODEX_HOME) {
        homes.push(process.env.CODEX_HOME);
    }

    if (process.platform === 'win32') {
        const userProfile = process.env.USERPROFILE || os.homedir();
        homes.push(path.join(userProfile, '.codex'));
    } else {
        homes.push(path.join(os.homedir(), '.codex'));
    }

    homes.push(path.join(os.homedir(), '.config', 'codex'));

    const unique = [];
    for (const item of homes) {
        const resolved = path.resolve(item);
        if (!unique.includes(resolved)) {
            unique.push(resolved);
        }
    }

    return unique;
}

function discoverCodexConfig() {
    const candidates = getCodexHomeCandidates().map(home => path.join(home, 'config.toml'));
    const existing = candidates.filter(filePath => fs.existsSync(filePath));
    const selected = existing[0] || null;

    return {
        selected,
        candidates,
        existing,
        codexHome: selected ? path.dirname(selected) : null
    };
}

module.exports = {
    ensureDir,
    getSlothToolHome,
    getPluginConfigsDir,
    getPluginConfigPath,
    getPluginCachePath,
    getBackupDir,
    getCodexHomeCandidates,
    discoverCodexConfig
};
