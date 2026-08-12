/**
 * @file GStoreTuiLayoutTest
 * @project SlothTool
 * @module Test / GStore TUI
 * @description 验证 gstore 使用 loc 风格的响应式主从布局、同步洞察和仓库缓存信息。
 * @logic 1. 隔离 HOME 渲染宽窄同步页；2. 校验操作、状态和诊断文案；3. 验证终端边界。
 * @dependencies TUI: ../plugins/gstore/lib/tui.js, Libraries: ink, Node: assert/fs/os/path/test
 * @index_tags gstore TUI测试, 响应式布局, 云同步, Git缓存, loc风格
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';
import React from 'react';
import {renderToString} from 'ink';
import {GStoreTuiApp, resolveGStoreTuiLayout} from '../plugins/gstore/lib/tui.js';

const originalHome = process.env.HOME;
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-gstore-tui-'));

after(() => {
    fs.rmSync(process.env.HOME, {recursive: true, force: true});
    process.env.HOME = originalHome;
});

function width(value) {
    const plain = value.replace(/\u001B\[[0-9;]*m/gu, '');
    return Array.from(plain).reduce((total, character) => {
        const code = character.codePointAt(0);
        const wide = code >= 0x1100 && (
            code <= 0x115F
            || (code >= 0x2E80 && code <= 0xA4CF && code !== 0x303F)
            || (code >= 0xAC00 && code <= 0xD7A3)
            || (code >= 0xF900 && code <= 0xFAFF)
            || (code >= 0xFE10 && code <= 0xFE19)
            || (code >= 0xFE30 && code <= 0xFE6F)
            || (code >= 0xFF00 && code <= 0xFF60)
            || (code >= 0xFFE0 && code <= 0xFFE6)
        );
        return total + (wide ? 2 : 1);
    }, 0);
}

test('gstore layout switches between wide, compact, and resize modes', () => {
    assert.equal(resolveGStoreTuiLayout(100, 24).compact, false);
    assert.equal(resolveGStoreTuiLayout(60, 24).compact, true);
    assert.equal(resolveGStoreTuiLayout(24, 12).tooSmall, true);
});

test('gstore sync page renders the complete cloud workflow without overflow', () => {
    for (const columns of [60, 100]) {
        const output = renderToString(React.createElement(GStoreTuiApp, {
            layoutOverride: resolveGStoreTuiLayout(columns, 24)
        }), {columns});
        assert.match(output, /双向安全同步/u);
        assert.match(output, /冲突时采用云端/u);
        assert.match(output, /同步范围：3 个/u);
        for (const line of output.split('\n')) {
            assert.ok(width(line) <= columns, `line exceeds ${columns}: ${line}`);
        }
    }
});

test('gstore repository and doctor pages expose cache and environment state', () => {
    const repository = renderToString(React.createElement(GStoreTuiApp, {
        layoutOverride: resolveGStoreTuiLayout(100, 24),
        initialTab: 'repository'
    }), {columns: 100});
    const doctor = renderToString(React.createElement(GStoreTuiApp, {
        layoutOverride: resolveGStoreTuiLayout(100, 24),
        initialTab: 'doctor'
    }), {columns: 100});
    assert.match(repository, /仓库缓存/u);
    assert.match(repository, /cache\/gstore\/repository/u);
    assert.match(doctor, /GitHub CLI/u);
    assert.match(doctor, /本地仓库缓存/u);
});
