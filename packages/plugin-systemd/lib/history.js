const os = require('os');
const path = require('path');
const fs = require('fs');
const config = require('./config');

function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

function getHistoryPath() {
    return path.join(getPluginConfigsDir(), 'systemd.history.json');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

function getDefaultHistory() {
    return {
        recentServices: [],
        recentSearches: [],
        actions: []
    };
}

function readHistory() {
    const historyPath = getHistoryPath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(historyPath)) {
        return getDefaultHistory();
    }

    try {
        const content = fs.readFileSync(historyPath, 'utf8');
        const history = JSON.parse(content);
        return {
            recentServices: Array.isArray(history.recentServices) ? history.recentServices : [],
            recentSearches: Array.isArray(history.recentSearches) ? history.recentSearches : [],
            actions: Array.isArray(history.actions) ? history.actions : []
        };
    } catch (error) {
        return getDefaultHistory();
    }
}

function writeHistory(history) {
    const historyPath = getHistoryPath();
    ensureDir(getPluginConfigsDir());
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

function trimList(list, limit) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.slice(0, limit);
}

function addRecentService(service) {
    if (!service) return;
    const cfg = config.readConfig();
    const history = readHistory();
    const newList = [service, ...history.recentServices.filter(item => item !== service)];
    history.recentServices = trimList(newList, cfg.historyLimits.services);
    writeHistory(history);
}

function addRecentSearch(search) {
    if (!search) return;
    const cfg = config.readConfig();
    const history = readHistory();
    const newList = [search, ...history.recentSearches.filter(item => item !== search)];
    history.recentSearches = trimList(newList, cfg.historyLimits.searches);
    writeHistory(history);
}

function addAction(action) {
    if (!action) return;
    const cfg = config.readConfig();
    const history = readHistory();
    const newList = [action, ...history.actions];
    history.actions = trimList(newList, cfg.historyLimits.actions);
    writeHistory(history);
}

function clearHistory() {
    writeHistory(getDefaultHistory());
}

module.exports = {
    readHistory,
    writeHistory,
    addRecentService,
    addRecentSearch,
    addAction,
    clearHistory
};
