const fs = require('fs');
const {
    getPluginConfigsDir,
    getConfigPath,
    ensureDir,
    safeParseJson
} = require('./utils');
const {createNoProfileError} = require('./error-mapper');

/**
 * 默认配置（首次启动时使用）
 */
function getDefaultConfig() {
    return {
        default_profile: 'local',
        profiles: {
            local: {
                base_url: 'https://api.openai.com/v1',
                api_key: '',
                low_model: 'gpt-4o-mini',
                high_model: 'gpt-4o',
                timeout: 60000
            }
        }
    };
}

/**
 * 清洗单个 profile，补齐必要字段
 */
function sanitizeProfile(profile) {
    const safe = profile || {};
    const defaults = getDefaultConfig().profiles.local;

    return {
        base_url: safe.base_url || defaults.base_url,
        api_key: safe.api_key || '',
        low_model: safe.low_model || defaults.low_model,
        high_model: safe.high_model || defaults.high_model,
        timeout: Number.isFinite(safe.timeout) ? safe.timeout : defaults.timeout
    };
}

/**
 * 清洗整体配置对象。
 * 规则：
 * - 如果来源没有 profiles 字段，自动注入默认 local
 * - 如果来源显式传入 profiles（哪怕为空），按显式结果保留
 */
function sanitizeConfig(input) {
    const defaults = getDefaultConfig();
    const source = input && typeof input === 'object' ? input : {};
    const hasProfilesField = Object.prototype.hasOwnProperty.call(source, 'profiles');
    const sourceProfiles = hasProfilesField && source.profiles && typeof source.profiles === 'object'
        ? source.profiles
        : null;

    const profiles = {};
    if (sourceProfiles) {
        Object.keys(sourceProfiles).forEach(name => {
            profiles[name] = sanitizeProfile(sourceProfiles[name]);
        });
    }

    if (!hasProfilesField) {
        profiles.local = sanitizeProfile(defaults.profiles.local);
    }

    const defaultProfile = Object.prototype.hasOwnProperty.call(source, 'default_profile')
        ? source.default_profile
        : defaults.default_profile;

    return {
        default_profile: defaultProfile,
        profiles
    };
}

/**
 * 读取配置文件
 */
function readConfig() {
    const configPath = getConfigPath();
    ensureDir(getPluginConfigsDir());

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const parsed = safeParseJson(content, {});
        return sanitizeConfig(parsed);
    } catch (error) {
        return getDefaultConfig();
    }
}

/**
 * 写入配置文件（写入前做清洗）
 */
function writeConfig(config) {
    ensureDir(getPluginConfigsDir());
    const configPath = getConfigPath();
    const sanitized = sanitizeConfig(config);
    fs.writeFileSync(configPath, JSON.stringify(sanitized, null, 2), 'utf8');
    return sanitized;
}

/**
 * 创建 profile
 */
function createProfile(name, profileConfig) {
    const config = readConfig();
    config.profiles[name] = sanitizeProfile(profileConfig);
    return writeConfig(config);
}

/**
 * 更新 profile
 */
function updateProfile(name, patch) {
    const config = readConfig();
    if (!config.profiles[name]) {
        throw createNoProfileError('Profile not found: ' + name);
    }

    config.profiles[name] = sanitizeProfile({...config.profiles[name], ...patch});
    return writeConfig(config);
}

/**
 * 删除 profile
 */
function deleteProfile(name) {
    const config = readConfig();
    if (!config.profiles[name]) {
        throw createNoProfileError('Profile not found: ' + name);
    }

    delete config.profiles[name];
    if (config.default_profile === name) {
        config.default_profile = '';
    }

    return writeConfig(config);
}

/**
 * 列出 profile
 */
function listProfiles() {
    const config = readConfig();
    return {
        default_profile: config.default_profile,
        profiles: config.profiles
    };
}

/**
 * 设置默认 profile
 */
function setDefaultProfile(name) {
    const config = readConfig();
    if (!config.profiles[name]) {
        throw createNoProfileError('Profile not found: ' + name);
    }

    config.default_profile = name;
    return writeConfig(config);
}

/**
 * 获取指定 profile，未指定则取默认 profile
 */
function getProfile(name) {
    const config = readConfig();
    const profileName = name || config.default_profile;

    if (!profileName || !config.profiles[profileName]) {
        throw createNoProfileError('Profile not found: ' + (profileName || 'default'));
    }

    return {
        profile_id: profileName,
        profile: sanitizeProfile(config.profiles[profileName])
    };
}

module.exports = {
    getDefaultConfig,
    readConfig,
    writeConfig,
    createProfile,
    updateProfile,
    deleteProfile,
    listProfiles,
    setDefaultProfile,
    getProfile,
    sanitizeProfile,
    sanitizeConfig
};
