const fs = require('fs');
const {
    getPluginConfigsDir,
    getCallLogPath,
    ensureDir
} = require('./utils');

// 最多保留最近 500 条调用记录
const MAX_CALLS = 500;

/**
 * 日志默认结构
 */
function getDefaultLog() {
    return {
        calls: []
    };
}

/**
 * 读取日志文件
 */
function readLog() {
    const logPath = getCallLogPath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(logPath)) {
        return getDefaultLog();
    }

    try {
        const content = fs.readFileSync(logPath, 'utf8');
        const parsed = JSON.parse(content);

        if (!parsed || !Array.isArray(parsed.calls)) {
            return getDefaultLog();
        }

        return {
            calls: parsed.calls
        };
    } catch (error) {
        return getDefaultLog();
    }
}

/**
 * 写入日志文件
 */
function writeLog(log) {
    const logPath = getCallLogPath();
    ensureDir(getPluginConfigsDir());

    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
}

/**
 * 新增一条调用日志（头插 + 截断）
 */
function addCall(record) {
    if (!record || typeof record !== 'object') {
        return;
    }

    const log = readLog();
    const calls = [record, ...log.calls];
    log.calls = calls.slice(0, MAX_CALLS);
    writeLog(log);
}

/**
 * 获取全部调用日志（已按新到旧排序）
 */
function listCalls() {
    return readLog().calls;
}

/**
 * 按 call_id 查询单次调用
 */
function getCall(callId) {
    if (!callId) {
        return null;
    }

    const calls = listCalls();
    return calls.find(item => item.call_id === callId) || null;
}

module.exports = {
    addCall,
    listCalls,
    getCall
};
