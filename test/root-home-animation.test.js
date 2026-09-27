/**
 * @file RootHomeLayoutTest
 * @project SlothTool
 * @module Test / Root TUI
 * @description 验证首页 Logo 在低高度时让位给工作目录与操作入口。
 * @logic 在宽高充足和窄低窗口渲染同一首页，校验主要操作始终可见。
 * @dependencies HomePage: ../lib/tui/root/pages/home-page.js, Ink: renderToString, Node: assert/test
 * @index_tags 根TUI测试, 首页, Logo, 响应式布局
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToString} from 'ink';
import {HomePage} from '../lib/tui/root/pages/home-page.js';
import {HOME_ART} from '../lib/tui/root/constants.js';
import {getDisplayWidth} from '../lib/tui/root/format.js';

test('home keeps work directory and actions visible in low and narrow windows', () => {
    const items = [
        {id: 'loc', kind: 'run-plugin', title: 'loc'},
        {id: 'gstore', kind: 'run-plugin', title: 'gstore'},
        {id: 'install', kind: 'open-install', title: '浏览官方目录'}
    ];
    const output = renderToString(React.createElement(HomePage, {
        items, selectedIndex: 0, columns: 56, contentHeight: 7, cwd: '/tmp/project'
    }), {columns: 56});
    assert.match(output, /SlothTool/u);
    assert.match(output, /当前工作目录: \/tmp\/project/u);
    assert.match(output, /loc/u);
    assert.match(output, /浏览官方目录/u);
    assert.ok(output.split('\n').length <= 7);
    assert.ok(output.split('\n').every(line => getDisplayWidth(line) <= 56));

    const wide = renderToString(React.createElement(HomePage, {
        items, selectedIndex: 1, columns: 120, contentHeight: 20, cwd: '/tmp/project'
    }), {columns: 120});
    assert.match(wide, /SlothTool|███████/u);
    assert.match(wide, /gstore/u);
    assert.ok(wide.split('\n').length <= 20);
    assert.ok(HOME_ART.length > 0);
});
