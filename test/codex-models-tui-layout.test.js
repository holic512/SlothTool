/**
 * @file CodexModelsTuiLayoutTest
 * @project SlothTool
 * @module Test / Codex Models TUI
 * @description 验证 codex-models 使用统一的响应式 tab、圆角主从面板和底部状态栏。
 * @logic 1. 注入模型数据避免网络请求；2. 渲染模型和诊断页；3. 校验宽窄布局关键文案。
 * @dependencies TUI: ../plugins/codex-models/lib/tui.js, Libraries: ink, Node: assert/test
 * @index_tags codex-models TUI测试, 统一外壳, 响应式布局, 模型选择
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToString} from 'ink';
import {CodexModelsTuiApp, resolveCodexModelsTuiLayout} from '../plugins/codex-models/lib/tui.js';

process.env.SLOTHTOOL_LANGUAGE = 'en';

const result = {
    model: 'gpt-5.6-sol', reasoningEffort: 'high', modelProvider: 'custom', baseUrl: 'https://provider.example/v1', catalogPath: '/tmp/models.json',
    activeModelAvailable: true, activeModelInCatalog: true, activeReasoningSupported: true,
    models: [{
        id: 'gpt-5.6-sol', displayName: 'GPT-5.6 Sol', vendor: 'OpenAI', family: 'GPT-5.6 Sol', contextWindow: 1_050_000,
        reasoningEfforts: ['low', 'high', 'ultra'], defaultReasoningEffort: 'high', supportsSearchTool: true,
        inputModalities: ['text', 'image'], metadataSource: 'built-in'
    }]
};

test('codex-models layout switches to compact and resize modes', () => {
    assert.equal(resolveCodexModelsTuiLayout(100, 24).compact, false);
    assert.equal(resolveCodexModelsTuiLayout(60, 24).compact, true);
    assert.equal(resolveCodexModelsTuiLayout(24, 12).tooSmall, true);
});

test('codex-models renders the shared model browser shell', () => {
    const output = renderToString(React.createElement(CodexModelsTuiApp, {
        layoutOverride: resolveCodexModelsTuiLayout(100, 24),
        initialResult: result
    }), {columns: 100});
    assert.match(output, /\[Models\].*Diagnosis/u);
    assert.match(output, /Model library/u);
    assert.match(output, /GPT-5\.6 Sol/u);
    assert.match(output, /← high →/u);
});

test('codex-models diagnosis uses the same panel shell', () => {
    const output = renderToString(React.createElement(CodexModelsTuiApp, {
        layoutOverride: resolveCodexModelsTuiLayout(100, 24),
        initialTab: 'diagnosis',
        initialResult: result
    }), {columns: 100});
    assert.match(output, /Codex Custom Model Diagnosis/u);
    assert.match(output, /custom/u);
    assert.match(output, /https:\/\/provider\.example\/v1/u);
});
