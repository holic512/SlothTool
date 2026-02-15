const {sanitizeErrorMessage} = require('./security');

/**
 * 将内部/网络/Provider 异常统一映射为结构化错误码
 */
function mapError(error) {
    const mapped = {
        code: 'PROVIDER_ERROR',
        message: 'Provider error'
    };

    if (!error) {
        return mapped;
    }

    const status = error.status || error.statusCode;
    const code = error.code || '';
    const message = sanitizeErrorMessage(error.message || '');

    // 允许上游主动指定映射结果
    if (error.mappedCode && error.mappedMessage) {
        return {
            code: error.mappedCode,
            message: sanitizeErrorMessage(error.mappedMessage)
        };
    }

    // 认证失败
    if (status === 401 || status === 403) {
        return {
            code: 'AUTH_ERROR',
            message: message || 'Authentication failed'
        };
    }

    // 限流
    if (status === 429) {
        return {
            code: 'RATE_LIMIT',
            message: message || 'Rate limit exceeded'
        };
    }

    // 网络/连接/超时
    if (
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'ABORT_ERR' ||
        error.isNetworkError
    ) {
        return {
            code: 'NETWORK_ERROR',
            message: message || 'Network error'
        };
    }

    // 配置缺失
    if (message === 'NO_PROFILE' || code === 'NO_PROFILE') {
        return {
            code: 'NO_PROFILE',
            message: 'Profile not found'
        };
    }

    // 其余 provider 异常
    if (status) {
        return {
            code: 'PROVIDER_ERROR',
            message: message || ('Provider returned status ' + status)
        };
    }

    return {
        code: 'PROVIDER_ERROR',
        message: message || 'Provider error'
    };
}

/**
 * 构造标准 NO_PROFILE 错误对象
 */
function createNoProfileError(message) {
    const error = new Error(message || 'Profile not found');
    error.code = 'NO_PROFILE';
    error.mappedCode = 'NO_PROFILE';
    error.mappedMessage = message || 'Profile not found';
    return error;
}

module.exports = {
    mapError,
    createNoProfileError
};
