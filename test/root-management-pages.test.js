/**
 * @file RootManagementPagesTest
 * @project SlothTool
 * @module Test / Root TUI
 * @description 验证更新、卸载和设置页使用统一响应式主从布局、高对比调色板及可预期的状态与字段信息。
 * @logic 1. 在隔离 HOME 中构建三类管理项；2. 校验状态标签、亮色风险级别及当前值/下一值；3. 校验宽窄终端布局、统一调色板与旧 Tip 面板移除。
 * @dependencies RootTuiItems: ../lib/tui/root/items.js, SelectionBrowser: ../lib/tui/root/plugin-browser.js, Node: assert/test
 * @index_tags 根TUI测试, 更新页, 卸载页, 设置页, 高对比配色, 响应式布局
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';
import {
    buildSettingsItems,
    buildUninstallItems,
    buildUpdateItems,
    sortPluginItemsByRecentRun
} from '../lib/tui/root/items.js';
import {ROOT_TUI_COLORS} from '../lib/tui/root/constants.js';
import * as rootLayout from '../lib/tui/root/layout.js';
import {SettingsPage} from '../lib/tui/root/pages/settings-page.js';
import {UninstallPage} from '../lib/tui/root/pages/uninstall-page.js';
import {UpdatePage} from '../lib/tui/root/pages/update-page.js';
import {SelectionBrowserPage} from '../lib/tui/root/plugin-browser.js';

const originalHome = process.env.HOME;
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-management-pages-'));
process.env.HOME = testHome;

after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(testHome, {recursive: true, force: true});
});

test('settings items preview current and next values before execution', () => {
    const items = buildSettingsItems({
        language: 'zh',
        network: {
            proxy: {
                enabled: false,
                protocol: 'http',
                host: '127.0.0.1',
                port: 7980
            },
            github: {
                preset: 'gh-proxy',
                customBaseUrl: ''
            }
        }
    });

    assert.equal(items.length, 5);
    assert.equal(items[0].badge, '当前');
    assert.equal(items[0].badgeColor, 'greenBright');
    assert.equal(items[2].listMeta, '关闭');
    assert.deepEqual(items[2].fields.map(field => field.value), [
        '网络代理',
        '关闭',
        '开启',
        'http://127.0.0.1:7980'
    ]);
    assert.equal(items[3].fields[2].value, '7890');
    assert.equal(items[4].fields[2].value, '官方 GitHub');

    const page = SettingsPage({items, selectedIndex: 2, columns: 120});
    assert.equal(page.type, SelectionBrowserPage);
    assert.equal(page.props.listTitle, '设置项');
    assert.equal(page.props.listSummary, '5 个选项');
});

test('run items put the most recently launched plugin first without mutating the source list', () => {
    const items = [
        {alias: 'todo', lastRunAt: null},
        {alias: 'loc', lastRunAt: '2026-08-08T10:00:00.000Z'},
        {alias: 'gstore', lastRunAt: '2026-08-08T11:00:00.000Z'},
        {alias: 'codex-models', lastRunAt: 'invalid'}
    ];
    const sortedItems = sortPluginItemsByRecentRun(items);

    assert.deepEqual(sortedItems.map(item => item.alias), [
        'gstore',
        'loc',
        'codex-models',
        'todo'
    ]);
    assert.deepEqual(items.map(item => item.alias), [
        'todo',
        'loc',
        'gstore',
        'codex-models'
    ]);
});

test('update items expose version status, batch scope, and failure details', () => {
    const items = buildUpdateItems({
        outdatedCount: 1,
        errorCount: 1,
        items: [
            {
                targetId: 'self',
                kind: 'self',
                title: 'SlothTool',
                currentVersion: '1.7.2',
                latestVersion: '1.8.0',
                status: 'outdated',
                sourceLabel: 'npm registry',
                reason: ''
            },
            {
                targetId: 'loc',
                kind: 'plugin',
                title: 'loc',
                currentVersion: '1.0.0',
                latestVersion: '1.0.0',
                status: 'error',
                sourceLabel: 'GitHub Release',
                reason: 'fetch failed'
            }
        ]
    });

    assert.equal(items[0].listMeta, '刷新');
    assert.equal(items[1].fields[0].value, '1 个可更新目标');
    assert.equal(items[2].badge, '可更新');
    assert.equal(items[2].badgeColor, 'yellowBright');
    assert.equal(items[3].badgeColor, 'redBright');
    assert.equal(items[3].fields.at(-1).value, 'fetch failed');

    const page = UpdatePage({items, selectedIndex: 2, columns: 120});
    assert.equal(page.type, SelectionBrowserPage);
    assert.equal(page.props.listTitle, '更新中心');
    assert.equal(page.props.listSummary, '1 可更新 | 1 失败');
});

test('uninstall items distinguish plugin confirmation from full-data danger', () => {
    const items = buildUninstallItems([
        {
            alias: 'loc',
            packageName: '@holic512/plugin-loc',
            version: '1.2.0',
            purpose: '统计项目代码行数。',
            source: '官方（GitHub Release）',
            detail: 'GitHub Release'
        }
    ]);

    assert.equal(items[0].listLabel, 'loc');
    assert.equal(items[0].badge, '需确认');
    assert.equal(items[0].fields[3].value, '插件文件、配置与注册表记录');
    assert.equal(items[1].listLabel, '全部本地数据');
    assert.equal(items[1].badge, '高风险');
    assert.equal(items[1].badgeColor, 'redBright');
    assert.equal(items[1].listMetaColor, 'redBright');

    const page = UninstallPage({items, selectedIndex: 1, columns: 120});
    assert.equal(page.type, SelectionBrowserPage);
    assert.equal(page.props.listTitle, '卸载目标');
    assert.equal(page.props.listSummary, '1 个插件');
});

test('selection browser uses two panels when wide and one panel when compact', () => {
    const props = {
        items: [{id: 'item', title: 'Item', description: 'Description', fields: []}],
        selectedIndex: 0,
        emptyMessage: 'Empty',
        listTitle: 'List',
        listSummary: '1 item'
    };
    const wide = SelectionBrowserPage({...props, columns: 120});
    const compactElement = SelectionBrowserPage({...props, columns: 70});
    const compact = compactElement.type(compactElement.props);

    assert.equal(wide.props.flexDirection, 'row');
    assert.equal(compact.props.flexDirection, 'column');
    assert.equal(compact.props.borderStyle, 'round');
    assert.equal(rootLayout.TipPanel, undefined);
    assert.equal(rootLayout.StackedSelectionPage, undefined);
});

test('root TUI palette keeps selection and semantic states high contrast', () => {
    assert.deepEqual(ROOT_TUI_COLORS, {
        accent: 'cyanBright',
        secondary: 'magentaBright',
        success: 'greenBright',
        warning: 'yellowBright',
        danger: 'redBright',
        muted: 'gray',
        border: 'gray'
    });
});
