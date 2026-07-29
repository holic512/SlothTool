/**
 * @file CodexModelLibrary
 * @project SlothTool
 * @module Codex Models Plugin / Model Metadata
 * @description 提供跨厂商模型元数据初始化库，并把 provider 返回的能力字段与内置兼容画像合并为 Codex 模型目录条目所需的统一结构。
 * @logic 1. 优先采用 provider 显式元数据；2. 保留可调用原始 ID，并归一化 vendor/model 与路由后缀后匹配画像；3. 匹配已核验的 OpenAI、Anthropic、Google 模型画像；4. 对 Grok、DeepSeek、Qwen、Mistral、Kimi、GLM、MiniMax、Llama、Hunyuan、Baichuan、InternLM、StepFun、Nemotron、Jamba、Granite、Sonar 等常见模型提供保守兼容画像；5. 未知模型回退 low/medium/high。
 * @dependencies None
 * @index_tags codex, model metadata, reasoning effort, context window, OpenAI, Claude, Gemini, Grok, DeepSeek, Qwen, Kimi, Hunyuan, Baichuan, InternLM, Nemotron, compatibility
 * @author holic512
 */

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_EFFORTS = ['low', 'medium', 'high'];
const EFFORT_DESCRIPTIONS = {
    none: 'Disable reasoning',
    minimal: 'Minimal reasoning',
    low: 'Low reasoning effort',
    medium: 'Medium reasoning effort',
    high: 'High reasoning effort',
    xhigh: 'Extra-high reasoning effort',
    max: 'Maximum reasoning effort',
    ultra: 'Provider-defined ultra reasoning effort'
};

const PROFILE_SUMMARIES = [
    {family: 'OpenAI GPT-5.6 Sol', match: 'gpt-5.6-sol', contextWindow: 1_050_000, efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'], source: 'provider-extension'},
    {family: 'OpenAI GPT-5.6', match: 'gpt-5.6 / gpt-5.6-terra / gpt-5.6-luna', contextWindow: 1_050_000, efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], source: 'official'},
    {family: 'OpenAI GPT-5.6 Pro', match: 'gpt-5.6-pro', contextWindow: 1_050_000, efforts: ['medium', 'high', 'xhigh', 'max'], source: 'official'},
    {family: 'OpenAI GPT-5.5', match: 'gpt-5.5 / gpt-5.5-pro', contextWindow: 400_000, efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], source: 'official'},
    {family: 'OpenAI GPT-5.4', match: 'gpt-5.4 / mini / nano', contextWindow: 1_050_000, efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], source: 'official'},
    {family: 'OpenAI GPT-5.3 Codex', match: 'gpt-5.3-codex*', contextWindow: 400_000, efforts: ['low', 'medium', 'high', 'xhigh'], source: 'official-or-compatible'},
    {family: 'OpenAI gpt-oss', match: 'gpt-oss-*', contextWindow: 131_072, efforts: ['low', 'medium', 'high'], source: 'official'},
    {family: 'Anthropic Claude 4.6+/5', match: 'claude-opus-* / claude-sonnet-* / claude-fable-* / claude-mythos-*', contextWindow: 1_000_000, efforts: ['low', 'medium', 'high', 'xhigh', 'max'], source: 'official'},
    {family: 'Google Gemini 3.x', match: 'gemini-3.*', contextWindow: 1_048_576, efforts: ['minimal', 'low', 'medium', 'high'], source: 'official'},
    {family: 'xAI Grok 4.5', match: 'grok-4.5*', contextWindow: 500_000, efforts: ['low', 'medium', 'high'], source: 'official'},
    {family: 'DeepSeek', match: 'deepseek-*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Qwen / QwQ', match: 'qwen* / qwq*', contextWindow: 262_144, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Mistral / Codestral / Devstral', match: 'mistral* / codestral* / devstral*', contextWindow: 262_144, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Kimi / Moonshot', match: 'kimi* / moonshot*', contextWindow: 262_144, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Zhipu GLM / ChatGLM', match: 'glm* / chatglm*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'MiniMax', match: 'minimax* / abab*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Meta Llama', match: 'llama* / meta-llama*', contextWindow: 131_072, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Cohere Command', match: 'command* / cohere*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Amazon Nova', match: 'amazon-nova* / nova-*', contextWindow: 300_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Microsoft Phi', match: 'phi-*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Baidu ERNIE', match: 'ernie*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'ByteDance Doubao', match: 'doubao*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: '01.AI Yi', match: 'yi-*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Tencent Hunyuan', match: 'hunyuan* / tencent-hunyuan*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Baichuan', match: 'baichuan*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'InternLM', match: 'internlm*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'StepFun', match: 'step-* / stepfun*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'SenseTime SenseNova', match: 'sensechat* / sensenova*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'NVIDIA Nemotron', match: 'nemotron* / nvidia-nemotron*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'AI21 Jamba', match: 'jamba* / ai21-jamba*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'IBM Granite', match: 'granite* / ibm-granite*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'},
    {family: 'Perplexity Sonar', match: 'sonar* / perplexity-*', contextWindow: 128_000, efforts: DEFAULT_EFFORTS, source: 'compatibility'}
];

function profile(values) {
    return {
        vendor: 'Unknown',
        family: 'OpenAI-compatible model',
        contextWindow: DEFAULT_CONTEXT_WINDOW,
        maxContextWindow: values.contextWindow || DEFAULT_CONTEXT_WINDOW,
        reasoningEfforts: DEFAULT_EFFORTS,
        defaultReasoningEffort: 'medium',
        supportsSearchTool: false,
        supportsParallelToolCalls: false,
        supportsReasoningSummaries: true,
        inputModalities: ['text', 'image'],
        metadataSource: 'builtin-compatibility',
        metadataVerified: false,
        ...values
    };
}

function openAiProfile(id) {
    if (id === 'gpt-5.6-sol') {
        return profile({
            vendor: 'OpenAI-compatible',
            family: 'GPT-5.6 Sol provider extension',
            contextWindow: 1_050_000,
            maxContextWindow: 1_050_000,
            reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
            defaultReasoningEffort: 'high',
            supportsSearchTool: true,
            supportsParallelToolCalls: true,
            metadataSource: 'builtin-provider-extension'
        });
    }
    if (/^gpt-5\.6-(?:terra|luna)$/u.test(id)) {
        const variant = id.endsWith('-terra') ? 'Terra' : 'Luna';
        return profile({
            vendor: 'OpenAI',
            family: `GPT-5.6 ${variant}`,
            contextWindow: 1_050_000,
            maxContextWindow: 1_050_000,
            reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
            defaultReasoningEffort: 'medium',
            supportsSearchTool: true,
            supportsParallelToolCalls: true,
            metadataSource: 'builtin-official',
            metadataVerified: true
        });
    }
    if (id === 'gpt-5.6-pro') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.6 Pro', contextWindow: 1_050_000, maxContextWindow: 1_050_000, reasoningEfforts: ['medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'high', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.6') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.6', contextWindow: 1_050_000, maxContextWindow: 1_050_000, reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.5-pro') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.5 Pro', contextWindow: 400_000, maxContextWindow: 400_000, reasoningEfforts: ['medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'high', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.5') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.5', contextWindow: 400_000, maxContextWindow: 400_000, reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.4-mini') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.4 mini', contextWindow: 400_000, maxContextWindow: 400_000, reasoningEfforts: ['low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.4-nano') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.4 nano', contextWindow: 400_000, maxContextWindow: 400_000, reasoningEfforts: ['none', 'low', 'medium', 'high'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.4') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.4', contextWindow: 1_050_000, maxContextWindow: 1_050_000, reasoningEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id === 'gpt-5.3-codex') {
        return profile({vendor: 'OpenAI', family: 'GPT-5.3 Codex', contextWindow: 400_000, maxContextWindow: 400_000, reasoningEfforts: ['low', 'medium', 'high', 'xhigh'], defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id.startsWith('gpt-5.3-codex')) {
        return profile({vendor: 'OpenAI-compatible', family: 'GPT-5.3 Codex variant', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (id.startsWith('gpt-oss-')) {
        return profile({vendor: 'OpenAI', family: 'gpt-oss', contextWindow: 131_072, maxContextWindow: 131_072, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (/^gpt-image-/u.test(id)) {
        return profile({vendor: 'OpenAI', family: 'GPT Image', contextWindow: 32_000, maxContextWindow: 32_000, reasoningEfforts: ['none'], defaultReasoningEffort: 'none', supportsReasoningSummaries: false, inputModalities: ['text', 'image'], metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (/^(?:gpt|o\d|codex)-/u.test(id)) {
        return profile({vendor: 'OpenAI-compatible', family: 'GPT / Codex compatible', reasoningEfforts: DEFAULT_EFFORTS, supportsParallelToolCalls: true});
    }
    return null;
}

function claudeProfile(id) {
    if (!id.startsWith('claude-')) {
        return null;
    }
    const officialModels = new Set([
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-opus-4-7',
        'claude-opus-4-8',
        'claude-opus-5',
        'claude-sonnet-5',
        'claude-fable-5',
        'claude-mythos-5',
        'claude-mythos-preview'
    ]);
    if (officialModels.has(id)) {
        const supportsXhigh = /^(?:claude-opus-(?:4-[78]|5)|claude-sonnet-5)$/u.test(id);
        const familyName = id.match(/^claude-([a-z]+)-/u)?.[1] || 'claude';
        return profile({
            vendor: 'Anthropic',
            family: `Claude ${familyName[0].toUpperCase()}${familyName.slice(1)}`,
            contextWindow: 1_000_000,
            maxContextWindow: 1_000_000,
            reasoningEfforts: supportsXhigh ? ['low', 'medium', 'high', 'xhigh', 'max'] : ['low', 'medium', 'high', 'max'],
            defaultReasoningEffort: 'high',
            supportsParallelToolCalls: true,
            metadataSource: 'builtin-official',
            metadataVerified: true
        });
    }
    return profile({vendor: 'Anthropic', family: 'Claude compatible', contextWindow: 200_000, maxContextWindow: 200_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'high', supportsParallelToolCalls: true});
}

function geminiProfile(id) {
    if (!id.startsWith('gemini-')) {
        return null;
    }
    if (/^gemini-3\.(?:1|5|6)-(?:pro|flash|flash-lite)$/u.test(id) || id === 'gemini-3-flash-preview') {
        const isFlashLite = id.includes('flash-lite');
        const defaultEffort = isFlashLite ? 'minimal' : (/^gemini-3\.(?:5|6)-flash$/u.test(id) ? 'medium' : 'high');
        const efforts = id.includes('pro') ? ['low', 'medium', 'high'] : ['minimal', 'low', 'medium', 'high'];
        return profile({
            vendor: 'Google',
            family: 'Gemini 3',
            contextWindow: 1_048_576,
            maxContextWindow: 1_048_576,
            reasoningEfforts: efforts,
            defaultReasoningEffort: defaultEffort,
            supportsSearchTool: true,
            supportsParallelToolCalls: true,
            inputModalities: ['text', 'image', 'audio'],
            metadataSource: 'builtin-official',
            metadataVerified: true
        });
    }
    return profile({vendor: 'Google', family: 'Gemini compatible', contextWindow: 1_048_576, maxContextWindow: 1_048_576, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'high', supportsSearchTool: true, supportsParallelToolCalls: true, inputModalities: ['text', 'image', 'audio']});
}

function commonVendorProfile(id) {
    if (/^grok-4\.5/u.test(id)) {
        return profile({vendor: 'xAI', family: 'Grok 4.5', contextWindow: 500_000, maxContextWindow: 500_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'high', supportsSearchTool: true, supportsParallelToolCalls: true, metadataSource: 'builtin-official', metadataVerified: true});
    }
    if (id.startsWith('grok-')) {
        return profile({vendor: 'xAI', family: 'Grok compatible', reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'high', supportsSearchTool: true, supportsParallelToolCalls: true});
    }
    if (/^deepseek-/u.test(id)) {
        return profile({vendor: 'DeepSeek', family: 'DeepSeek compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: id.includes('reasoner') || id.includes('r1') ? 'high' : 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:qwen|qwq)/u.test(id)) {
        return profile({vendor: 'Alibaba Cloud', family: 'Qwen compatible', contextWindow: 262_144, maxContextWindow: 262_144, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:mistral|codestral|devstral)/u.test(id)) {
        return profile({vendor: 'Mistral AI', family: 'Mistral compatible', contextWindow: 262_144, maxContextWindow: 262_144, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:kimi|moonshot)/u.test(id)) {
        return profile({vendor: 'Moonshot AI', family: 'Kimi compatible', contextWindow: 262_144, maxContextWindow: 262_144, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:glm|chatglm)/u.test(id)) {
        return profile({vendor: 'Zhipu AI', family: 'GLM compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: id.includes('thinking') ? 'high' : 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:minimax|abab)/u.test(id)) {
        return profile({vendor: 'MiniMax', family: 'MiniMax compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: id.includes('reasoning') ? 'high' : 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:llama|meta-llama)/u.test(id)) {
        return profile({vendor: 'Meta', family: 'Llama compatible', contextWindow: 131_072, maxContextWindow: 131_072, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:command(?:-r)?|cohere)/u.test(id)) {
        return profile({vendor: 'Cohere', family: 'Command compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:amazon-)?nova-/u.test(id)) {
        return profile({vendor: 'Amazon', family: 'Nova compatible', contextWindow: 300_000, maxContextWindow: 300_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true, inputModalities: ['text', 'image', 'video']});
    }
    if (/^phi-/u.test(id)) {
        return profile({vendor: 'Microsoft', family: 'Phi compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^ernie/u.test(id)) {
        return profile({vendor: 'Baidu', family: 'ERNIE compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^doubao/u.test(id)) {
        return profile({vendor: 'ByteDance', family: 'Doubao compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^yi-/u.test(id)) {
        return profile({vendor: '01.AI', family: 'Yi compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:tencent-)?hunyuan/u.test(id)) {
        return profile({vendor: 'Tencent', family: 'Hunyuan compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^baichuan/u.test(id)) {
        return profile({vendor: 'Baichuan AI', family: 'Baichuan compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^internlm/u.test(id)) {
        return profile({vendor: 'Shanghai AI Laboratory', family: 'InternLM compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:step-|stepfun)/u.test(id)) {
        return profile({vendor: 'StepFun', family: 'Step compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:sensechat|sensenova)/u.test(id)) {
        return profile({vendor: 'SenseTime', family: 'SenseNova compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:nvidia-)?nemotron/u.test(id)) {
        return profile({vendor: 'NVIDIA', family: 'Nemotron compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:ai21-)?jamba/u.test(id)) {
        return profile({vendor: 'AI21 Labs', family: 'Jamba compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:ibm-)?granite/u.test(id)) {
        return profile({vendor: 'IBM', family: 'Granite compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsParallelToolCalls: true});
    }
    if (/^(?:sonar|perplexity-)/u.test(id)) {
        return profile({vendor: 'Perplexity', family: 'Sonar compatible', contextWindow: 128_000, maxContextWindow: 128_000, reasoningEfforts: DEFAULT_EFFORTS, defaultReasoningEffort: 'medium', supportsSearchTool: true, supportsParallelToolCalls: true});
    }
    return null;
}

function normalizeEffortList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const efforts = [];
    for (const item of value) {
        const effort = typeof item === 'string'
            ? item
            : (item?.effort || item?.reasoningEffort || item?.reasoning_effort || item?.id);
        if (typeof effort === 'string' && effort.trim() && !efforts.includes(effort.trim())) {
            efforts.push(effort.trim());
        }
    }
    return efforts;
}

function finitePositiveNumber(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) {
            return Math.trunc(number);
        }
    }
    return 0;
}

function booleanValue(...values) {
    for (const value of values) {
        if (typeof value === 'boolean') {
            return value;
        }
    }
    return undefined;
}

function variantInfo(modelId) {
    const suffixes = [
        ['-extra-low', 'low'],
        ['-minimal', 'minimal'],
        ['-medium', 'medium'],
        ['-xhigh', 'xhigh'],
        ['-ultra', 'ultra'],
        ['-high', 'high'],
        ['-low', 'low'],
        ['-max', 'max'],
        ['-thinking', 'high']
    ];
    for (const [suffix, effort] of suffixes) {
        if (modelId.endsWith(suffix)) {
            return {baseId: modelId.slice(0, -suffix.length), requestedEffort: effort};
        }
    }
    return {baseId: modelId, requestedEffort: ''};
}

function modelLookupId(modelId) {
    const normalized = String(modelId || '').trim().toLowerCase().replaceAll('\\', '/');
    const namespacedId = normalized.split('/').filter(Boolean).at(-1) || normalized;
    return namespacedId.split(':')[0];
}

function resolveBuiltInProfile(modelId) {
    const lookupId = modelLookupId(modelId);
    const variant = variantInfo(lookupId);
    if (variant.baseId !== lookupId) {
        const base = openAiProfile(variant.baseId) || claudeProfile(variant.baseId) || geminiProfile(variant.baseId) || commonVendorProfile(variant.baseId);
        if (base) {
            return {...base, defaultReasoningEffort: base.reasoningEfforts.includes(variant.requestedEffort) ? variant.requestedEffort : base.defaultReasoningEffort};
        }
    }
    return openAiProfile(lookupId) || claudeProfile(lookupId) || geminiProfile(lookupId) || commonVendorProfile(lookupId) || profile({});
}

function capabilitySupported(value) {
    return value === true || (value && typeof value === 'object' && value.supported === true);
}

function effortCapabilityList(value) {
    if (!value || typeof value !== 'object' || value.supported === false) {
        return [];
    }
    return ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']
        .filter(effort => capabilitySupported(value[effort]));
}

function readProviderEfforts(model) {
    return normalizeEffortList(
        model.supported_reasoning_levels
        || model.supportedReasoningEfforts
        || model.supported_reasoning_efforts
        || model.reasoning_efforts
        || model.capabilities?.reasoning_efforts
    ).concat(effortCapabilityList(model.capabilities?.effort))
        .filter((effort, index, efforts) => efforts.indexOf(effort) === index);
}

export function resolveModelMetadata(model) {
    const id = String(model?.id || model?.model || model?.slug || '').trim();
    if (!id) {
        throw new Error('A model id is required to resolve model metadata.');
    }
    const builtIn = resolveBuiltInProfile(id);
    const providerEfforts = readProviderEfforts(model);
    const providerContext = finitePositiveNumber(
        model.context_window,
        model.contextWindow,
        model.max_context_window,
        model.maxContextWindow,
        model.context_length,
        model.contextLength,
        model.input_token_limit,
        model.inputTokenLimit,
        model.max_input_tokens,
        model.maxInputTokens,
        model.capabilities?.context_window
    );
    const defaultReasoningEffort = String(
        model.default_reasoning_level
        || model.defaultReasoningEffort
        || model.default_reasoning_effort
        || model.reasoning_effort
        || ''
    );
    const reasoningEfforts = providerEfforts.length ? providerEfforts : [...builtIn.reasoningEfforts];
    const requested = variantInfo(modelLookupId(id)).requestedEffort;
    const resolvedDefault = reasoningEfforts.includes(defaultReasoningEffort)
        ? defaultReasoningEffort
        : (reasoningEfforts.includes(requested)
            ? requested
            : (reasoningEfforts.includes(builtIn.defaultReasoningEffort) ? builtIn.defaultReasoningEffort : reasoningEfforts[0]));
    const providerMetadataUsed = Boolean(
        providerEfforts.length
        || providerContext
        || defaultReasoningEffort
        || typeof model.supports_search_tool === 'boolean'
        || typeof model.supportsSearchTool === 'boolean'
        || typeof model.supports_parallel_tool_calls === 'boolean'
        || typeof model.supportsParallelToolCalls === 'boolean'
        || typeof model.supports_reasoning_summaries === 'boolean'
        || typeof model.supportsReasoningSummaries === 'boolean'
        || Array.isArray(model.input_modalities)
        || Array.isArray(model.inputModalities)
    );

    return {
        id,
        displayName: String(model.display_name || model.displayName || id),
        description: String(model.description || `${builtIn.vendor}: ${builtIn.family}`),
        vendor: builtIn.vendor,
        family: builtIn.family,
        contextWindow: providerContext || builtIn.contextWindow,
        maxContextWindow: finitePositiveNumber(model.max_context_window, model.maxContextWindow, model.max_input_tokens, model.maxInputTokens) || providerContext || builtIn.maxContextWindow,
        reasoningEfforts,
        reasoningOptions: reasoningEfforts.map(effort => ({effort, description: EFFORT_DESCRIPTIONS[effort] || `${effort} reasoning effort`})),
        defaultReasoningEffort: resolvedDefault,
        supportsSearchTool: booleanValue(model.supports_search_tool, model.supportsSearchTool, model.capabilities?.web_search, builtIn.supportsSearchTool) ?? false,
        supportsParallelToolCalls: booleanValue(model.supports_parallel_tool_calls, model.supportsParallelToolCalls, builtIn.supportsParallelToolCalls) ?? false,
        supportsReasoningSummaries: booleanValue(model.supports_reasoning_summaries, model.supportsReasoningSummaries, builtIn.supportsReasoningSummaries) ?? true,
        inputModalities: Array.isArray(model.input_modalities)
            ? model.input_modalities
            : (Array.isArray(model.inputModalities) ? model.inputModalities : [...builtIn.inputModalities]),
        metadataSource: providerMetadataUsed ? 'provider' : builtIn.metadataSource,
        metadataVerified: providerMetadataUsed || builtIn.metadataVerified
    };
}

export function listBuiltInProfiles() {
    return PROFILE_SUMMARIES.map(item => ({...item, efforts: [...item.efforts]}));
}

export function getFallbackReasoningEfforts() {
    return [...DEFAULT_EFFORTS];
}
