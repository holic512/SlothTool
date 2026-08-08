/**
 * @file LocTuiLayoutTest
 * @project SlothTool
 * @module Test / LOC Plugin TUI
 * @description 验证 loc TUI 的宽高响应式布局、统计洞察、目录输入规范化和关键页面字符串渲染。
 * @logic 1. 校验宽屏、窄屏和低高度的布局密度；2. 校验扩展名聚合与热点文件排序；3. 在隔离 HOME 中渲染宽窄页面并检查终端边界。
 * @dependencies TUI: ../plugins/loc/lib/tui.js, Model: ../plugins/loc/lib/tui-model.js, Libraries: ink, Node: assert/fs/os/path/test
 * @index_tags loc TUI测试, 响应式布局, 扩展名分布, 热点文件, 路径输入
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';
import React from 'react';
import {renderToString} from 'ink';
import {LocTuiApp} from '../plugins/loc/lib/tui.js';
import {
    buildDistributionBar,
    buildResultInsights,
    getDisplayWidth,
    normalizeDirectoryInput,
    resolveLocTuiLayout
} from '../plugins/loc/lib/tui-model.js';

const originalHome = process.env.HOME;
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-loc-tui-layout-'));
process.env.HOME = testHome;

after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(testHome, {recursive: true, force: true});
});

function buildSampleResult() {
    const root = '/demo/project';
    return {
        resolvedDir: root,
        fileCount: 5,
        lineCount: 1090,
        verbose: true,
        warnings: ['skip'],
        files: [
            {path: `${root}/src/index.js`, lines: 420},
            {path: `${root}/src/app.js`, lines: 310},
            {path: `${root}/src/model.ts`, lines: 180},
            {path: `${root}/README.md`, lines: 120},
            {path: `${root}/style.css`, lines: 60}
        ]
    };
}

function assertLinesFit(output, columns) {
    for (const line of output.split('\n')) {
        assert.ok(getDisplayWidth(line) <= columns, `line exceeds ${columns} columns: ${line}`);
    }
}

test('loc layout adapts columns, rows, page size, and detail density', () => {
    const wide = resolveLocTuiLayout(100, 24);
    const compact = resolveLocTuiLayout(60, 24);
    const short = resolveLocTuiLayout(60, 18);

    assert.equal(wide.compact, false);
    assert.equal(wide.pageSize, 12);
    assert.equal(wide.topFileLimit, 2);
    assert.equal(compact.compact, true);
    assert.equal(compact.pageSize, 6);
    assert.equal(compact.showConfigDetail, true);
    assert.equal(compact.compactFooter, true);
    assert.equal(compact.microFooter, false);
    assert.equal(short.short, true);
    assert.equal(short.pageSize, 8);
    assert.equal(short.showConfigDetail, false);
    assert.equal(short.topFileLimit, 0);
    assert.equal(resolveLocTuiLayout(24, 12).tooSmall, true);
});

test('loc result insights aggregate extensions and rank hotspot files', () => {
    const insights = buildResultInsights(buildSampleResult());

    assert.equal(insights.averageLines, 218);
    assert.equal(insights.warningCount, 1);
    assert.deepEqual(insights.extensions[0], {
        extension: 'js',
        fileCount: 2,
        lineCount: 730
    });
    assert.deepEqual(insights.topFiles.slice(0, 2), [
        {path: 'src/index.js', lines: 420},
        {path: 'src/app.js', lines: 310}
    ]);
    assert.equal(buildDistributionBar(50, 100, 10), '█████░░░░░');
});

test('loc directory input accepts quoted and escaped pasted paths', () => {
    assert.equal(normalizeDirectoryInput('  "/tmp/my project"  '), '/tmp/my project');
    assert.equal(normalizeDirectoryInput("'/tmp/my project'"), '/tmp/my project');
    assert.equal(normalizeDirectoryInput('/tmp/my\\ project'), '/tmp/my project');
    assert.equal(normalizeDirectoryInput(''), '.');
});

test('loc count page renders complete responsive layouts without overflowing', () => {
    const compactLayout = resolveLocTuiLayout(60, 24);
    const wideLayout = resolveLocTuiLayout(100, 24);
    const compactOutput = renderToString(h(LocTuiApp, {
        layoutOverride: compactLayout
    }), {columns: 60});
    const wideOutput = renderToString(h(LocTuiApp, {
        layoutOverride: wideLayout,
        initialResult: buildSampleResult()
    }), {columns: 100});

    assert.match(compactOutput, /统计当前目录/u);
    assert.match(compactOutput, /重置为默认配置/u);
    assert.match(compactOutput, /统计概览/u);
    assert.match(wideOutput, /扩展名分布/u);
    assert.match(wideOutput, /src\/index\.js/u);
    assert.match(wideOutput, /1 条扫描告警/u);
    assertLinesFit(compactOutput, 60);
    assertLinesFit(wideOutput, 100);
});

test('loc config page stacks selected rule details on compact terminals', () => {
    const layout = resolveLocTuiLayout(60, 24);
    const output = renderToString(h(LocTuiApp, {
        layoutOverride: layout,
        initialTab: 'extensions'
    }), {columns: 60});

    assert.match(output, /文件扩展名/u);
    assert.match(output, /第 1\/6 页/u);
    assert.match(output, /\.js  \[参与统计\]/u);
    assert.match(output, /配置概览  33\/33 已启用/u);
    assertLinesFit(output, 60);
});

test('loc low-height pages keep controls inside a single bounded panel', () => {
    const layout = resolveLocTuiLayout(60, 18);
    const countOutput = renderToString(h(LocTuiApp, {
        layoutOverride: layout
    }), {columns: 60});
    const configOutput = renderToString(h(LocTuiApp, {
        layoutOverride: layout,
        initialTab: 'extensions'
    }), {columns: 60});

    assert.match(countOutput, /统计当前目录/u);
    assert.match(countOutput, /等待第一次统计/u);
    assert.doesNotMatch(countOutput, /统计概览/u);
    assert.match(configOutput, /第 1\/5 页/u);
    assert.doesNotMatch(configOutput, /配置概览/u);
    assertLinesFit(countOutput, 60);
    assertLinesFit(configOutput, 60);
});

test('loc extremely small terminals render a bounded resize message', () => {
    const layout = resolveLocTuiLayout(24, 12);
    const output = renderToString(h(LocTuiApp, {
        layoutOverride: layout
    }), {columns: 24});

    assert.match(output, /终端空间不足/u);
    assert.match(output, /30\s+列 × 14 行/u);
    assert.doesNotMatch(output, /开始统计/u);
    assertLinesFit(output, 24);
});

function h(type, props) {
    return React.createElement(type, props);
}
