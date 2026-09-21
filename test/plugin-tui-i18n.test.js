/**
 * @file PluginTuiI18nTest
 * @project SlothTool
 * @module Test / Plugin TUI
 * @description 验证官方插件与模板已经提供统一 TUI 外壳所需的 tab、响应式 footer 和状态栏文案键。
 * @logic 1. 直接读取插件 i18n 消息字典；2. 校验中英文 tab、响应式 footer 与核心页面文案；3. 防止双语外壳文案缺失。
 * @dependencies I18N: loc/image-compress/gstore/codex-models/pzip/slothvault/template-basic, Node: assert/test
 * @index_tags 插件i18n测试, loc, image-compress, pzip, slothvault, slothvault-mcp, template-basic, TUI外壳
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {messages as imageCompressMessages} from '../plugins/image-compress/lib/i18n.js';
import {messages as gstoreMessages} from '../plugins/gstore/lib/i18n.js';
import {messages as codexModelsMessages} from '../plugins/codex-models/lib/i18n.js';
import {messages as locMessages} from '../plugins/loc/lib/i18n.js';
import {messages as pzipMessages} from '../plugins/pzip/lib/i18n.js';
import {messages as slothVaultMcpMessages} from '../plugins/slothvault/lib/i18n.js';
import {messages as templateMessages} from '../plugins/template-basic/lib/i18n.js';

test('loc TUI shell keys exist in zh and en', () => {
    assert.equal(locMessages.zh.tui.tabs.count, '统计');
    assert.equal(locMessages.en.tui.tabs.count, 'Count');
    assert.match(locMessages.zh.tui.footer.count, /Tab/u);
    assert.match(locMessages.zh.tui.footer.config, /\[\/\]/u);
    assert.match(locMessages.en.tui.footer.compactConfig, /Space/u);
    assert.equal(locMessages.zh.tui.result.extensionDistribution, '扩展名分布');
    assert.equal(locMessages.en.tui.config.extensionType, 'File extension');
    assert.match(locMessages.en.tui.help.lines.join('\n'), /\[\/\]/u);
    assert.equal(locMessages.zh.tui.status.ready, '就绪');
    assert.equal(locMessages.en.tui.status.ready, 'Ready');
});

test('image-compress responsive TUI keys exist in zh and en', () => {
    assert.equal(imageCompressMessages.zh.tui.tabs.run, '运行');
    assert.equal(imageCompressMessages.en.tui.tabs.run, 'Run');
    assert.match(imageCompressMessages.zh.tui.footer.options, /Space/u);
    assert.match(imageCompressMessages.en.tui.footer.compactRun, /Enter/u);
    assert.equal(imageCompressMessages.zh.tui.panels.targets, '输入队列');
    assert.equal(imageCompressMessages.en.tui.result.wouldSave, 'Would save');
    assert.match(imageCompressMessages.zh.tui.optionDetails.dryRun, /不写入文件/u);
});

test('template TUI shell keys exist in zh and en', () => {
    assert.equal(templateMessages.zh.tui.tabs.actions, '操作');
    assert.equal(templateMessages.en.tui.tabs.actions, 'Actions');
    assert.match(templateMessages.en.tui.footer, /Tab/u);
    assert.equal(templateMessages.zh.tui.status.ready, '就绪');
    assert.equal(templateMessages.en.tui.status.ready, 'Ready');
});

test('pzip TUI shell keys exist in zh and en', () => {
    assert.equal(pzipMessages.zh.tui.tabs.compress, '压缩');
    assert.equal(pzipMessages.en.tui.tabs.filters, 'Filters');
    assert.match(pzipMessages.zh.tui.footer.compress, /Tab/u);
    assert.match(pzipMessages.en.tui.footer.filters, /Space/u);
    assert.equal(pzipMessages.zh.tui.status.ready, '就绪：按 Enter 将当前设置压缩为 ZIP。');
    assert.equal(pzipMessages.en.tui.actions.addPattern, 'Add pattern');
});

test('gstore and codex-models expose the shared tab and footer shell in both languages', () => {
    assert.equal(gstoreMessages.zh.tui.tabs.sync, '同步');
    assert.equal(gstoreMessages.en.tui.tabs.sync, 'Sync');
    assert.match(gstoreMessages.zh.tui.footer.sync, /Tab/u);
    assert.equal(codexModelsMessages.zh.tui.tabs.models, '模型');
    assert.equal(codexModelsMessages.en.tui.tabs.models, 'Models');
    assert.match(codexModelsMessages.en.tui.footer.models, /Tab/u);
});

test('SlothVault multifunction package exposes bilingual MCP and local-manager TUI copy', () => {
    assert.equal(slothVaultMcpMessages.zh.tui.tabs.status, '状态');
    assert.equal(slothVaultMcpMessages.en.tui.tabs.status, 'Status');
    assert.equal(slothVaultMcpMessages.zh.tui.tabs.capabilities, '能力');
    assert.equal(slothVaultMcpMessages.en.tui.tabs.profiles, 'Profiles');
    assert.match(slothVaultMcpMessages.zh.tui.footer, /Tab/u);
    assert.match(slothVaultMcpMessages.en.tui.footer, /refresh/u);
    assert.match(slothVaultMcpMessages.zh.tui.help, /不会调用 Tool/u);
    assert.match(slothVaultMcpMessages.en.tui.help, /never calls Tools/u);
    assert.match(slothVaultMcpMessages.zh.tui.profile.browseFooter, /新增/u);
    assert.match(slothVaultMcpMessages.en.tui.profile.browseFooter, /add/u);
    assert.match(slothVaultMcpMessages.zh.httpWarning, /明文传输/u);
    assert.match(slothVaultMcpMessages.en.httpWarning, /clear text/u);
    assert.equal(slothVaultMcpMessages.zh.manager.title, 'SlothVault 多功能包');
    assert.equal(slothVaultMcpMessages.en.manager.title, 'SlothVault multifunction package');
    assert.equal(slothVaultMcpMessages.zh.manager.states.registered, '已注册');
    assert.equal(slothVaultMcpMessages.en.manager.states['not-registered'], 'not registered');
});
