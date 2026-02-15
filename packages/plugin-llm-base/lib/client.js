const {getProfile} = require('./config');
const {mapError} = require('./error-mapper');
const {addCall} = require('./call-log');
const {generateCallId, resolveEndpoint} = require('./utils');

/**
 * 规范化 usage 字段，统一为 input_tokens/output_tokens
 */
function normalizeUsage(rawUsage) {
    const usage = rawUsage || {};
    return {
        input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
        output_tokens: usage.completion_tokens || usage.output_tokens || 0
    };
}

/**
 * 发送 JSON POST 请求（OpenAI 协议兼容）
 */
async function requestJson(url, payload, profileConfig) {
    const controller = new AbortController();
    const timeoutMs = profileConfig.timeout || 60000;
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + profileConfig.api_key
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const text = await response.text();
        let body = null;

        try {
            body = text ? JSON.parse(text) : {};
        } catch (error) {
            body = {raw: text};
        }

        if (!response.ok) {
            const err = new Error(
                (body && body.error && body.error.message)
                    ? body.error.message
                    : ('HTTP ' + response.status)
            );
            err.status = response.status;
            throw err;
        }

        return body;
    } catch (error) {
        // 统一超时异常为网络错误分支
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Request timeout');
            timeoutError.code = 'ETIMEDOUT';
            throw timeoutError;
        }

        // 非 HTTP status 视为网络层错误
        if (!error.status) {
            error.isNetworkError = true;
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 统一成功结构
 */
function buildSuccess(callId, model, data, usage) {
    return {
        success: true,
        model,
        data,
        usage: normalizeUsage(usage),
        call_id: callId
    };
}

/**
 * 统一失败结构
 */
function buildFailure(callId, error) {
    const mapped = mapError(error);
    return {
        success: false,
        error: {
            code: mapped.code,
            message: mapped.message
        },
        call_id: callId
    };
}

/**
 * 聊天接口：根据 mode 自动切 low/high 模型
 */
async function llm_chat(messages, mode = 'low', profile = null) {
    const callId = generateCallId();
    const start = Date.now();

    try {
        const {profile_id, profile: profileConfig} = getProfile(profile);
        const actualMode = mode === 'high' ? 'high' : 'low';
        const selectedModel = actualMode === 'high' ? profileConfig.high_model : profileConfig.low_model;

        const payload = {
            model: selectedModel,
            messages: Array.isArray(messages) ? messages : []
        };

        const response = await requestJson(
            resolveEndpoint(profileConfig.base_url, '/chat/completions'),
            payload,
            profileConfig
        );

        const content = response
            && Array.isArray(response.choices)
            && response.choices[0]
            && response.choices[0].message
            ? response.choices[0].message.content
            : '';

        const result = buildSuccess(callId, selectedModel, content, response.usage);

        // 日志只记录元信息，不记录用户输入正文
        addCall({
            call_id: callId,
            timestamp: new Date().toISOString(),
            profile: profile_id,
            model: selectedModel,
            duration_ms: Date.now() - start,
            success: true,
            usage: result.usage
        });

        return result;
    } catch (error) {
        const failure = buildFailure(callId, error);

        addCall({
            call_id: callId,
            timestamp: new Date().toISOString(),
            profile: profile || null,
            model: null,
            duration_ms: Date.now() - start,
            success: false,
            usage: null
        });

        return failure;
    }
}

/**
 * 原始透传接口：请求体由调用方提供
 */
async function llm_raw(payload, profile = null) {
    const callId = generateCallId();
    const start = Date.now();

    try {
        const {profile_id, profile: profileConfig} = getProfile(profile);
        const response = await requestJson(
            resolveEndpoint(profileConfig.base_url, '/chat/completions'),
            payload || {},
            profileConfig
        );

        const selectedModel = response.model || payload.model || profileConfig.low_model;
        const result = buildSuccess(callId, selectedModel, response, response.usage);

        addCall({
            call_id: callId,
            timestamp: new Date().toISOString(),
            profile: profile_id,
            model: selectedModel,
            duration_ms: Date.now() - start,
            success: true,
            usage: result.usage
        });

        return result;
    } catch (error) {
        const failure = buildFailure(callId, error);

        addCall({
            call_id: callId,
            timestamp: new Date().toISOString(),
            profile: profile || null,
            model: null,
            duration_ms: Date.now() - start,
            success: false,
            usage: null
        });

        return failure;
    }
}

module.exports = {
    llm_chat,
    llm_raw
};
