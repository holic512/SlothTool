const {getProfile} = require('./config');
const {mapError} = require('./error-mapper');
const {addCall} = require('./call-log');
const {generateCallId, resolveEndpoint} = require('./utils');

// 严格 JSON 模式系统提示词：强制模型仅输出 JSON 对象
const JSON_MODE_SYSTEM_PROMPT = [
    'You are in strict JSON mode.',
    'You must return exactly one valid JSON object and nothing else.',
    'Do not output markdown, code fences, or explanations.',
    'If the user asks for plain text, wrap it as JSON fields.',
    'If you cannot fulfill the request, still return a JSON object with an error field.'
].join('\n');

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
 * 清洗并规范 messages
 */
function normalizeMessages(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .filter(item => item && typeof item === 'object' && typeof item.role === 'string')
        .map(item => ({
            role: item.role,
            content: item.content === undefined || item.content === null ? '' : item.content
        }));
}

/**
 * 给对话追加严格 JSON 模式约束
 */
function withStrictJsonMode(messages) {
    const normalized = normalizeMessages(messages);
    return [{
        role: 'system',
        content: JSON_MODE_SYSTEM_PROMPT
    }, ...normalized];
}

/**
 * 从 message.content 提取文本
 */
function contentToText(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content.map(part => {
            if (typeof part === 'string') {
                return part;
            }
            if (part && typeof part === 'object') {
                if (typeof part.text === 'string') {
                    return part.text;
                }
                if (part.type === 'text' && typeof part.text === 'string') {
                    return part.text;
                }
            }
            return '';
        }).join('').trim();
    }

    if (content && typeof content === 'object') {
        return JSON.stringify(content);
    }

    return '';
}

/**
 * 从 provider 响应中提取 assistant 文本
 */
function extractAssistantText(response) {
    const message = response
        && Array.isArray(response.choices)
        && response.choices[0]
        && response.choices[0].message
        ? response.choices[0].message
        : null;

    if (!message) {
        return '';
    }

    return contentToText(message.content);
}

/**
 * 去掉可能的 ```json 代码块包裹
 */
function stripCodeFence(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const trimmed = text.trim();
    const matched = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return matched ? matched[1].trim() : trimmed;
}

/**
 * 尝试将字符串解析为 JSON 对象
 */
function tryParseJsonObject(text) {
    if (typeof text !== 'string') {
        return null;
    }

    const cleaned = stripCodeFence(text);

    try {
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        return {result: parsed};
    } catch (error) {
        // ignore
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const maybeJson = cleaned.slice(firstBrace, lastBrace + 1);
        try {
            const parsed = JSON.parse(maybeJson);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            return {result: parsed};
        } catch (error) {
            // ignore
        }
    }

    return null;
}

/**
 * 确保最终 data 一定是 JSON 对象
 */
function ensureJsonObject(content) {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
        return content;
    }

    if (typeof content === 'string') {
        const parsed = tryParseJsonObject(content);
        if (parsed) {
            return parsed;
        }

        return {
            result: content.trim(),
            _fallback: true,
            _reason: 'model_output_was_not_valid_json'
        };
    }

    if (content === undefined || content === null) {
        return {
            result: null
        };
    }

    return {
        result: content
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
 * 聊天接口：根据 mode 自动切 low/high 模型，且始终返回 JSON data
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
            messages: withStrictJsonMode(messages)
        };

        const response = await requestJson(
            resolveEndpoint(profileConfig.base_url, '/chat/completions'),
            payload,
            profileConfig
        );

        const text = extractAssistantText(response);
        const jsonData = ensureJsonObject(text);
        const result = buildSuccess(callId, selectedModel, jsonData, response.usage);

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
