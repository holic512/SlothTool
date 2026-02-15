/**
 * 脱敏 API Key：保留前 3 位 + 后 4 位
 */
function maskApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return '';
    }

    const trimmed = apiKey.trim();
    if (trimmed.length <= 8) {
        return '***';
    }

    return trimmed.slice(0, 3) + '***' + trimmed.slice(-4);
}

/**
 * 脱敏单个 profile
 */
function maskProfile(profile) {
    if (!profile || typeof profile !== 'object') {
        return profile;
    }

    return {
        ...profile,
        api_key: maskApiKey(profile.api_key)
    };
}

/**
 * 脱敏整个配置对象
 */
function maskConfig(config) {
    if (!config || typeof config !== 'object') {
        return config;
    }

    const maskedProfiles = {};
    const profiles = config.profiles || {};

    Object.keys(profiles).forEach(name => {
        maskedProfiles[name] = maskProfile(profiles[name]);
    });

    return {
        ...config,
        profiles: maskedProfiles
    };
}

/**
 * 清洗错误消息中的敏感字段，避免 key/header 回显
 */
function sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string') {
        return '';
    }

    return message
        .replace(/sk-[A-Za-z0-9\-_]+/g, '***')
        .replace(/(Bearer\s+)[^\s]+/gi, '$1***')
        .replace(/("api[_-]?key"\s*:\s*")[^"]+("?)/gi, '$1***$2');
}

module.exports = {
    maskApiKey,
    maskProfile,
    maskConfig,
    sanitizeErrorMessage
};
