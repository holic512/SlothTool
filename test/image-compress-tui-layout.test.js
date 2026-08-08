/**
 * @file ImageCompressTuiLayoutTest
 * @project SlothTool
 * @module Test / Image Compress Plugin TUI
 * @description 验证 image-compress TUI 的宽高响应式布局、压缩收益洞察、选项分页和关键页面渲染。
 * @logic 1. 校验宽屏、窄屏、低高度和极小终端布局；2. 校验实际与预演结果聚合；3. 渲染运行、选项和历史页面并检查终端边界。
 * @dependencies TUI: ../plugins/image-compress/lib/tui.js, Model: ../plugins/image-compress/lib/tui-model.js, Libraries: ink, Node: assert/fs/os/path/test
 * @index_tags 图片压缩TUI测试, 响应式布局, 压缩收益, 选项分页, 终端边界
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';
import React from 'react';
import {renderToString} from 'ink';
import {ImageCompressTuiApp} from '../plugins/image-compress/lib/tui.js';
import {
    buildCompressionInsights,
    getDisplayWidth,
    getVisibleOptionPage,
    resolveImageCompressTuiLayout
} from '../plugins/image-compress/lib/tui-model.js';

const originalHome = process.env.HOME;
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-tui-'));
process.env.HOME = testHome;

after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(testHome, {recursive: true, force: true});
});

function buildSampleSummary({preview = false, failed = false} = {}) {
    const root = '/demo/photos';
    const successStatus = preview ? 'dry_run' : 'success';
    const results = [
        {
            InputPath: `${root}/hero.jpg`,
            OutputPath: `${root}/hero.compressed.jpg`,
            Status: successStatus,
            OriginalBytes: 1_000_000,
            ResultBytes: 600_000,
            BytesSaved: 400_000,
            CompressionRatio: 0.4,
            Width: 2000,
            Height: 1200,
            OutputWidth: 1600,
            OutputHeight: 960
        },
        {
            InputPath: `${root}/icon.png`,
            OutputPath: `${root}/icon.compressed.png`,
            Status: failed ? 'failed' : successStatus,
            Error: failed ? 'decode failed' : '',
            OriginalBytes: 500_000,
            ResultBytes: failed ? 0 : 350_000,
            BytesSaved: failed ? 0 : 150_000,
            CompressionRatio: failed ? 0 : 0.3
        }
    ];

    return {
        Results: results,
        TotalFiles: 2,
        SuccessCount: preview ? 0 : (failed ? 1 : 2),
        SkippedCount: preview ? 2 : 0,
        FailedCount: failed ? 1 : 0,
        SavedBytes: preview ? 0 : 550_000,
        Cancelled: false
    };
}

function assertLinesFit(output, columns) {
    for (const line of output.split('\n')) {
        assert.ok(getDisplayWidth(line) <= columns, `line exceeds ${columns} columns: ${line}`);
    }
}

function renderApp(layout, props = {}) {
    return renderToString(h(ImageCompressTuiApp, {
        layoutOverride: layout,
        ...props
    }), {columns: layout.columns});
}

test('image-compress layout adapts panels, details, and option page size', () => {
    const wide = resolveImageCompressTuiLayout(110, 24);
    const compact = resolveImageCompressTuiLayout(70, 24);
    const tallCompact = resolveImageCompressTuiLayout(70, 30);
    const short = resolveImageCompressTuiLayout(60, 18);

    assert.equal(wide.compact, false);
    assert.equal(wide.showRunResult, true);
    assert.equal(wide.optionPageSize, 9);
    assert.equal(compact.compact, true);
    assert.equal(compact.showRunResult, false);
    assert.equal(compact.optionPageSize, 5);
    assert.equal(tallCompact.showRunResult, true);
    assert.equal(short.short, true);
    assert.equal(short.showOptionDetail, false);
    assert.equal(short.optionPageSize, 4);
    assert.equal(resolveImageCompressTuiLayout(24, 12).tooSmall, true);
});

test('image-compress insights expose preview savings and real failures', () => {
    const previewInsights = buildCompressionInsights(buildSampleSummary({preview: true}));
    const failedInsights = buildCompressionInsights(buildSampleSummary({failed: true}));

    assert.equal(previewInsights.preview, true);
    assert.equal(previewInsights.savedBytes, 550_000);
    assert.equal(previewInsights.savingRate, 550_000 / 1_500_000);
    assert.equal(previewInsights.issues.length, 0);
    assert.equal(previewInsights.topSavings[0].inputPath, '/demo/photos/hero.jpg');
    assert.equal(failedInsights.preview, false);
    assert.equal(failedInsights.failedCount, 1);
    assert.equal(failedInsights.issues[0].error, 'decode failed');
});

test('image-compress option pagination follows the selected item', () => {
    const page = getVisibleOptionPage(
        ['output', 'quality', 'width', 'height', 'recursive', 'overwrite', 'larger', 'dry', 'workers'],
        7,
        5
    );

    assert.equal(page.pageIndex, 1);
    assert.equal(page.pageCount, 2);
    assert.equal(page.localSelectedIndex, 2);
    assert.deepEqual(page.items, ['overwrite', 'larger', 'dry', 'workers']);
});

test('image-compress wide run page shows queue, execution plan, and savings without overflow', () => {
    const layout = resolveImageCompressTuiLayout(110, 24);
    const output = renderApp(layout, {
        initialPaths: ['/demo/photos/hero.jpg', '/demo/photos/icon.png'],
        initialSummary: buildSampleSummary()
    });

    assert.match(output, /压缩工作台/u);
    assert.match(output, /输入队列/u);
    assert.match(output, /质量 82/u);
    assert.match(output, /最近任务/u);
    assert.match(output, /高收益文件/u);
    assert.match(output, /hero\.jpg/u);
    assertLinesFit(output, 110);
});

test('image-compress compact run page keeps latest metrics in the action panel', () => {
    const layout = resolveImageCompressTuiLayout(70, 24);
    const output = renderApp(layout, {
        initialPaths: ['/demo/photos/hero.jpg'],
        initialSummary: buildSampleSummary({preview: true})
    });

    assert.match(output, /压缩工作台/u);
    assert.match(output, /预计节省/u);
    assert.match(output, /输入队列/u);
    assert.doesNotMatch(output, /最近任务/u);
    assertLinesFit(output, 70);
});

test('image-compress option page explains the selected second-page setting', () => {
    const layout = resolveImageCompressTuiLayout(70, 24);
    const output = renderApp(layout, {
        initialTab: 'options',
        initialOptionIndex: 7
    });

    assert.match(output, /压缩参数/u);
    assert.match(output, /2\/2/u);
    assert.match(output, /预演模式/u);
    assert.match(output, /不写入文件/u);
    assertLinesFit(output, 70);
});

test('image-compress history and tiny-terminal pages remain bounded', () => {
    const historyLayout = resolveImageCompressTuiLayout(60, 18);
    const historyOutput = renderApp(historyLayout, {
        initialTab: 'history',
        initialHistory: [{
            id: 1,
            label: '12:00:00',
            summary: buildSampleSummary()
        }]
    });
    const tinyLayout = resolveImageCompressTuiLayout(24, 12);
    const tinyOutput = renderApp(tinyLayout);

    assert.match(historyOutput, /本次会话/u);
    assert.match(historyOutput, /12:00:00/u);
    assertLinesFit(historyOutput, 60);
    assert.match(tinyOutput, /终端空间不足/u);
    assertLinesFit(tinyOutput, 24);
});

function h(type, props) {
    return React.createElement(type, props);
}
