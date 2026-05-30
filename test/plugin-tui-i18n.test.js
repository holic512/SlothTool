/**
 * @file PluginTuiI18nTest
 * @project SlothTool
 * @module Test / Plugin TUI
 * @description 验证 loc 与模板插件已经提供统一 TUI 外壳所需的 tab、footer 和状态栏文案键。
 * @logic 1. 直接读取插件 i18n 消息字典；2. 校验中英文 tab 与状态栏关键键存在；3. 防止脚手架和官方插件的外壳键形状再次分叉。
 * @dependencies I18N: ../plugins/loc/lib/i18n.js, ../plugins/template-basic/lib/i18n.js, Node: assert/test
 * @index_tags 插件i18n测试, loc, template-basic, TUI外壳
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {messages as locMessages} from '../plugins/loc/lib/i18n.js';
import {messages as templateMessages} from '../plugins/template-basic/lib/i18n.js';

test('loc TUI shell keys exist in zh and en', () => {
    assert.equal(locMessages.zh.tui.tabs.count, '统计');
    assert.equal(locMessages.en.tui.tabs.count, 'Count');
    assert.match(locMessages.zh.tui.footer, /Tab/u);
    assert.equal(locMessages.zh.tui.status.ready, '就绪');
    assert.equal(locMessages.en.tui.status.ready, 'Ready');
});

test('template TUI shell keys exist in zh and en', () => {
    assert.equal(templateMessages.zh.tui.tabs.actions, '操作');
    assert.equal(templateMessages.en.tui.tabs.actions, 'Actions');
    assert.match(templateMessages.en.tui.footer, /Tab/u);
    assert.equal(templateMessages.zh.tui.status.ready, '就绪');
    assert.equal(templateMessages.en.tui.status.ready, 'Ready');
});
