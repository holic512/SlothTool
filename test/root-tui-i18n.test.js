/**
 * @file RootTuiI18nTest
 * @project SlothTool
 * @module Test / Root TUI
 * @description 验证根 TUI 关键导航与底栏文案在中英文环境下具备稳定的本地化输出。
 * @logic 1. 直接读取 i18n 消息字典；2. 校验首页标签、状态栏和帮助提示的双语文案；3. 防止根 TUI 关键 chrome 回退为硬编码英文。
 * @dependencies I18N: ../lib/i18n.js, Node: assert/test
 * @index_tags 根TUI测试, i18n, 导航文案, 状态栏
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {messages} from '../lib/i18n.js';

test('root TUI zh chrome is localized', () => {
    assert.equal(messages.zh.tui.tabs.home, '首页');
    assert.equal(messages.zh.tui.tabs.danger, '危险区');
    assert.equal(messages.zh.tui.status.ready, '就绪');
    assert.match(messages.zh.tui.footer.help, /帮助/u);
});

test('root TUI en chrome stays explicit', () => {
    assert.equal(messages.en.tui.tabs.home, 'Home');
    assert.equal(messages.en.tui.tabs.danger, 'Danger Zone');
    assert.equal(messages.en.tui.status.ready, 'Ready');
    assert.match(messages.en.tui.footer.help, /help/u);
});
