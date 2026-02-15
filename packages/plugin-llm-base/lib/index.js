const config = require('./config');
const client = require('./client');
const callLog = require('./call-log');
const {mapError} = require('./error-mapper');

/**
 * 统一成功包装（用于配置/日志类接口）
 */
function safeSuccess(data) {
    return {
        success: true,
        data
    };
}

/**
 * 统一失败包装（用于配置/日志类接口）
 */
function safeFailure(error) {
    const mapped = mapError(error);
    return {
        success: false,
        error: {
            code: mapped.code,
            message: mapped.message
        }
    };
}

/**
 * 创建 profile
 */
function create_profile(name, profileConfig) {
    try {
        const result = config.createProfile(name, profileConfig);
        return safeSuccess(result);
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 更新 profile
 */
function update_profile(profile_id, patch) {
    try {
        const result = config.updateProfile(profile_id, patch || {});
        return safeSuccess(result);
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 删除 profile
 */
function delete_profile(profile_id) {
    try {
        const result = config.deleteProfile(profile_id);
        return safeSuccess(result);
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 列出 profiles
 */
function list_profiles() {
    try {
        const result = config.listProfiles();
        return safeSuccess(result);
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 设置默认 profile
 */
function set_default_profile(profile_id) {
    try {
        const result = config.setDefaultProfile(profile_id);
        return safeSuccess(result);
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 聊天调用（mode: low/high）
 */
async function llm_chat(messages, mode = 'low', profile = null) {
    try {
        if (mode !== 'low' && mode !== 'high') {
            return {
                success: false,
                error: {
                    code: 'PROVIDER_ERROR',
                    message: 'Invalid mode, only low/high are allowed'
                },
                call_id: null
            };
        }

        return await client.llm_chat(messages, mode, profile);
    } catch (error) {
        const mapped = mapError(error);
        return {
            success: false,
            error: {
                code: mapped.code,
                message: mapped.message
            },
            call_id: null
        };
    }
}

/**
 * 原始透传调用
 */
async function llm_raw(payload, profile = null) {
    try {
        return await client.llm_raw(payload, profile);
    } catch (error) {
        const mapped = mapError(error);
        return {
            success: false,
            error: {
                code: mapped.code,
                message: mapped.message
            },
            call_id: null
        };
    }
}

/**
 * 列出调用日志
 */
function list_calls() {
    try {
        return safeSuccess(callLog.listCalls());
    } catch (error) {
        return safeFailure(error);
    }
}

/**
 * 获取单次调用日志
 */
function get_call(call_id) {
    try {
        return safeSuccess(callLog.getCall(call_id));
    } catch (error) {
        return safeFailure(error);
    }
}

module.exports = {
    create_profile,
    update_profile,
    delete_profile,
    list_profiles,
    set_default_profile,
    llm_chat,
    llm_raw,
    list_calls,
    get_call
};
