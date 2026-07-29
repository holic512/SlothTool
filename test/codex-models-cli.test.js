/**
 * @file CodexModelsCliTest
 * @project SlothTool
 * @module Test / Codex Models Plugin
 * @description 验证 Codex Models 插件的跨厂商模型库、目录生成、推理等级切换、凭据脱敏和离线修复脚本安全约束。
 * @logic 1. 使用临时 CODEX_HOME 与 mock provider；2. 验证模型元数据优先级和配置原子更新；3. 对生成脚本执行语法与安全关键字检查。
 * @dependencies Node: assert/child_process/fs/os/path/test; Plugin: ../plugins/codex-models/lib/*
 * @index_tags codex-models, model library, reasoning effort, catalog, statsig, offline repair, tests
 * @author holic512
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {getFallbackReasoningEfforts, resolveModelMetadata} from '../plugins/codex-models/lib/model-library.js';
import {
    createCatalogEntry,
    createDesktopRepairScript,
    inspectCodexModels,
    normalizeModelList,
    parseTomlDocument,
    setCodexModel,
    setCodexReasoningEffort,
    setTomlValue,
    syncModelCatalog
} from '../plugins/codex-models/lib/service.js';

const rootDir = path.resolve(import.meta.dirname, '..');
const pluginBin = path.join(rootDir, 'plugins', 'codex-models', 'bin', 'codex-models.js');

function createCodexHome(configOverrides = '') {
    const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-codex-models-'));
    const config = `model = "gpt-5.6-sol" # keep active model comment\nmodel_provider = "custom"\nmodel_reasoning_effort = "high"\n${configOverrides}\n[model_providers.custom]\nbase_url = "https://provider.example/v1"\nwire_api = "responses"\nrequires_openai_auth = true\nexperimental_bearer_token = "secret-provider-token"\n`;
    fs.writeFileSync(path.join(codexHome, 'config.toml'), config);
    return codexHome;
}

function providerRequest(models, verify = () => {}) {
    return async (url, options) => {
        verify(url, options);
        return {
            ok: true,
            async json() {
                return {data: models};
            }
        };
    };
}

test('CLI help includes model library and reasoning commands', () => {
    const output = execFileSync(process.execPath, [pluginBin, '--help'], {cwd: rootDir, encoding: 'utf8'});
    assert.match(output, /reasoning set <effort>/u);
    assert.match(output, /library show <model-id>/u);
    assert.match(output, /--reasoning <effort>/u);
});

test('TUI exits through the smoke hook without requiring a TTY', () => {
    assert.doesNotThrow(() => {
        execFileSync(process.execPath, [pluginBin], {
            cwd: rootDir,
            encoding: 'utf8',
            env: {...process.env, SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION: 'exit'}
        });
    });
});

test('TOML parser and setter preserve comments, CRLF, and root key position', () => {
    const source = 'model = "old" # preserve\r\n\r\n[model_providers.custom]\r\nbase_url = "https://example.test/v1"\r\n';
    const updated = setTomlValue(source, '', 'model', 'new');
    const withReasoning = setTomlValue(updated, '', 'model_reasoning_effort', 'high');
    assert.match(withReasoning, /^model = "new" # preserve\r\n/u);
    assert.match(withReasoning, /model_reasoning_effort = "high"\r\n\[model_providers\.custom\]/u);
    assert.ok(withReasoning.endsWith('\r\n'));
    const parsed = parseTomlDocument(withReasoning);
    assert.equal(parsed.root.model, 'new');
    assert.equal(parsed.root.model_reasoning_effort, 'high');
});

test('cross-vendor library includes extended and conservative reasoning profiles', () => {
    const sol = resolveModelMetadata({id: 'gpt-5.6-sol'});
    assert.deepEqual(sol.reasoningEfforts, ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
    assert.equal(sol.contextWindow, 1_050_000);

    const openAi = resolveModelMetadata({id: 'gpt-5.6'});
    assert.ok(openAi.reasoningEfforts.includes('max'));
    assert.equal(openAi.reasoningEfforts.includes('ultra'), false);
    assert.equal(openAi.metadataVerified, true);

    for (const id of ['gpt-5.6-terra', 'gpt-5.6-luna']) {
        const variant = resolveModelMetadata({id});
        assert.equal(variant.vendor, 'OpenAI');
        assert.equal(variant.contextWindow, 1_050_000);
        assert.ok(variant.reasoningEfforts.includes('max'));
        assert.equal(variant.reasoningEfforts.includes('ultra'), false);
        assert.equal(variant.metadataVerified, true);
    }

    const claude = resolveModelMetadata({id: 'claude-opus-4-6'});
    assert.equal(claude.vendor, 'Anthropic');
    assert.ok(claude.reasoningEfforts.includes('max'));

    const gemini = resolveModelMetadata({id: 'gemini-3.1-flash-lite'});
    assert.equal(gemini.vendor, 'Google');
    assert.ok(gemini.reasoningEfforts.includes('minimal'));

    const claudeThinking = resolveModelMetadata({id: 'claude-opus-4-6-thinking'});
    assert.equal(claudeThinking.contextWindow, 1_000_000);
    assert.ok(claudeThinking.reasoningEfforts.includes('max'));
    assert.equal(claudeThinking.defaultReasoningEffort, 'high');

    const claudeFive = resolveModelMetadata({id: 'claude-opus-5'});
    assert.ok(claudeFive.reasoningEfforts.includes('xhigh'));
    assert.ok(claudeFive.reasoningEfforts.includes('max'));
    assert.equal(claudeFive.metadataVerified, true);

    const geminiVariant = resolveModelMetadata({id: 'gemini-3.5-flash-extra-low'});
    assert.equal(geminiVariant.contextWindow, 1_048_576);
    assert.ok(geminiVariant.reasoningEfforts.includes('minimal'));
    assert.equal(geminiVariant.defaultReasoningEffort, 'low');

    const grok = resolveModelMetadata({id: 'grok-4.5'});
    assert.equal(grok.contextWindow, 500_000);
    assert.deepEqual(grok.reasoningEfforts, ['low', 'medium', 'high']);
    assert.equal(grok.metadataVerified, true);

    const vendors = ['deepseek-reasoner', 'qwen3-coder', 'grok-4.5', 'mistral-large', 'kimi-k2', 'glm-5', 'minimax-m2', 'llama-4', 'command-r', 'amazon-nova-pro', 'phi-4', 'ernie-5', 'doubao-seed', 'yi-large', 'hunyuan-t1', 'baichuan4', 'internlm3', 'step-3', 'sensechat-5', 'nemotron-ultra', 'jamba-large', 'granite-4', 'sonar-pro'];
    for (const id of vendors) {
        const metadata = resolveModelMetadata({id});
        assert.notEqual(metadata.vendor, 'Unknown', id);
        assert.ok(metadata.reasoningEfforts.length >= 2, id);
    }

    assert.deepEqual(resolveModelMetadata({id: 'vendor-private-model'}).reasoningEfforts, ['low', 'medium', 'high']);
    assert.deepEqual(getFallbackReasoningEfforts(), ['low', 'medium', 'high']);
});

test('cross-vendor library recognizes namespaced gateway model ids without changing the callable id', () => {
    const sol = resolveModelMetadata({id: 'openai/gpt-5.6-sol'});
    const claude = resolveModelMetadata({id: 'anthropic/claude-opus-4-6-thinking'});
    const gemini = resolveModelMetadata({id: 'google/gemini-3.5-flash-extra-low'});
    const deepseek = resolveModelMetadata({id: 'deepseek/deepseek-r1:free'});

    assert.equal(sol.id, 'openai/gpt-5.6-sol');
    assert.deepEqual(sol.reasoningEfforts, ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
    assert.equal(claude.vendor, 'Anthropic');
    assert.equal(claude.contextWindow, 1_000_000);
    assert.equal(claude.defaultReasoningEffort, 'high');
    assert.equal(gemini.vendor, 'Google');
    assert.equal(gemini.contextWindow, 1_048_576);
    assert.equal(gemini.defaultReasoningEffort, 'low');
    assert.equal(deepseek.vendor, 'DeepSeek');
    assert.deepEqual(deepseek.reasoningEfforts, ['low', 'medium', 'high']);
});

test('provider metadata accepts capability maps and max_input_tokens from common vendor model APIs', () => {
    const [model] = normalizeModelList({data: [{
        id: 'claude-opus-5',
        max_input_tokens: 777_000,
        capabilities: {
            effort: {
                supported: true,
                low: {supported: true},
                medium: {supported: true},
                high: {supported: true},
                xhigh: null,
                max: {supported: true}
            }
        }
    }]});
    assert.equal(model.contextWindow, 777_000);
    assert.equal(model.maxContextWindow, 777_000);
    assert.deepEqual(model.reasoningEfforts, ['low', 'medium', 'high', 'max']);
    assert.equal(model.metadataSource, 'provider');
    assert.equal(model.metadataVerified, true);
});

test('provider metadata overrides built-in metadata without retaining secrets', () => {
    const [model] = normalizeModelList({data: [{
        id: 'gpt-5.6-sol',
        display_name: 'Sol Enterprise',
        context_window: 777_777,
        max_context_window: 888_888,
        supported_reasoning_levels: [{effort: 'low'}, {effort: 'ultra'}],
        default_reasoning_level: 'ultra',
        supports_search_tool: false,
        input_modalities: ['text'],
        api_key: 'must-not-survive'
    }]});
    assert.equal(model.displayName, 'Sol Enterprise');
    assert.equal(model.contextWindow, 777_777);
    assert.equal(model.maxContextWindow, 888_888);
    assert.deepEqual(model.reasoningEfforts, ['low', 'ultra']);
    assert.equal(model.defaultReasoningEffort, 'ultra');
    assert.equal(model.supportsSearchTool, false);
    assert.equal(JSON.stringify(model).includes('must-not-survive'), false);
    assert.equal(model.metadataSource, 'provider');
});

test('catalog sync writes complete merged metadata and never returns credentials', async () => {
    const codexHome = createCodexHome();
    const request = providerRequest([
        {id: 'gpt-5.6-sol'},
        {id: 'claude-opus-4-6'},
        {id: 'private-model', context_window: 96_000, supported_reasoning_levels: ['low', 'high']}
    ], (url, options) => {
        assert.equal(url, 'https://provider.example/v1/models');
        assert.equal(options.headers.Authorization, 'Bearer secret-provider-token');
    });

    const diagnosis = await inspectCodexModels({codexHome, request});
    assert.equal(diagnosis.credential, 'configured');
    assert.equal(JSON.stringify(diagnosis).includes('secret-provider-token'), false);
    assert.equal(diagnosis.reasoningEffort, 'high');
    assert.equal(diagnosis.activeReasoningSupported, true);
    assert.ok(diagnosis.builtInProfiles.some(item => item.family === 'OpenAI GPT-5.6 Sol'));

    const result = await syncModelCatalog({codexHome, request});
    assert.equal(result.modelCount, 3);
    const catalog = JSON.parse(fs.readFileSync(result.catalogPath, 'utf8'));
    const sol = catalog.models.find(item => item.slug === 'gpt-5.6-sol');
    assert.equal(sol.context_window, 1_050_000);
    assert.deepEqual(sol.supported_reasoning_levels.map(item => item.effort), ['none', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
    assert.equal(sol.supports_search_tool, true);
    assert.equal(Object.hasOwn(sol, 'metadataSource'), false);
    assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /model_catalog_json = /u);
});

test('model and reasoning updates validate supported efforts and write once-compatible values', async () => {
    const codexHome = createCodexHome();
    const request = providerRequest([{id: 'gpt-5.6-sol'}, {id: 'gpt-image-1.5'}]);

    const ultra = await setCodexReasoningEffort('ultra', {codexHome, request});
    assert.equal(ultra.reasoningEffort, 'ultra');
    assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /model_reasoning_effort = "ultra"/u);

    await assert.rejects(
        setCodexReasoningEffort('impossible', {codexHome, request}),
        /does not support reasoning effort/u
    );

    const changed = await setCodexModel('gpt-image-1.5', {codexHome, request, reasoningEffort: 'ultra'});
    assert.equal(changed.reasoningEffort, 'none');
    const updated = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
    assert.match(updated, /model = "gpt-image-1\.5" # keep active model comment/u);
    assert.match(updated, /model_reasoning_effort = "none"/u);
});

test('catalog entry uses resolved model capabilities', () => {
    const entry = createCatalogEntry(resolveModelMetadata({
        id: 'provider-model',
        context_window: 64_000,
        supported_reasoning_levels: ['low', 'high'],
        default_reasoning_level: 'high',
        supports_search_tool: true,
        supports_parallel_tool_calls: true,
        input_modalities: ['text']
    }));
    assert.equal(entry.context_window, 64_000);
    assert.equal(entry.default_reasoning_level, 'high');
    assert.deepEqual(entry.supported_reasoning_levels.map(item => item.effort), ['low', 'high']);
    assert.equal(entry.supports_search_tool, true);
    assert.equal(entry.supports_parallel_tool_calls, true);
    assert.deepEqual(entry.input_modalities, ['text']);
});

test('repair generator creates an executable, syntax-valid, offline-only guarded script', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-codex-repair-'));
    const result = createDesktopRepairScript('gpt-5.6-sol', {outputDir});
    const source = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(fs.statSync(result.outputPath).mode & 0o100);
    assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', result.outputPath]));
    assert.match(source, /statsig\.cached\.evaluations\./u);
    assert.match(source, /107580212/u);
    assert.match(source, /lsof/u);
    assert.match(source, /Complete LevelDB backup/u);
    assert.match(source, /classic-level/u);
    assert.match(source, /buffer\[0\] === 0/u);
    assert.match(source, /buffer\[0\] === 1/u);
    assert.match(source, /available_models contains/u);
    assert.match(source, /use_hidden_models=/u);
    assert.match(source, /data\.evaluations\.time/u);
    assert.match(source, /outer\.evaluations\.time/u);
    assert.match(source, /--clear-evaluations/u);
    assert.doesNotMatch(source, /launchctl/u);
    assert.doesNotMatch(source, /app\.asar/u);
    assert.match(result.command, /--dry-run/u);
    assert.match(result.repairCommand, /--freeze-statsig-cache/u);
    assert.ok(result.command.includes(result.nodeExecutable));
});
