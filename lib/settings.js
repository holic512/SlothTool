/**
 * @file SlothToolSettingsStore
 * @project SlothTool
 * @module Core CLI / Storage
 * @description 负责读取和写入 SlothTool 的全局设置，当前主要管理语言配置。
 * @logic 1. 提供默认设置；2. 从 settings.json 读取并校验结构；3. 对外暴露语言读取与写入接口。
 * @dependencies Node: fs, Utils: ./utils.js
 * @index_tags 设置存储, language, settings.json, 全局配置
 * @author holic512
 */

import fs from 'node:fs';
import {ensureDir, getSettingsPath, getSlothToolHome} from './utils.js';

export function getDefaultSettings() {
    return {
        language: 'zh'
    };
}

export function readSettings() {
    const settingsPath = getSettingsPath();
    ensureDir(getSlothToolHome());

    if (!fs.existsSync(settingsPath)) {
        return getDefaultSettings();
    }

    const content = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(content);

    return {
        ...getDefaultSettings(),
        ...parsed
    };
}

export function writeSettings(settings) {
    ensureDir(getSlothToolHome());
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

export function getLanguage() {
    return readSettings().language || 'zh';
}

export function setLanguage(language) {
    if (!['zh', 'en'].includes(language)) {
        throw new Error('Language must be "zh" or "en".');
    }

    const settings = readSettings();
    settings.language = language;
    writeSettings(settings);
    return settings.language;
}

export default {
    getDefaultSettings,
    readSettings,
    writeSettings,
    getLanguage,
    setLanguage
};
