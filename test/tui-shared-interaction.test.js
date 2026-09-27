import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
    editText,
    editorViewport,
    getDisplayWidth,
    graphemes,
    nextTabIndex,
    truncateFromLeft,
    truncateFromRight,
    wrapText
} from '../lib/tui/shared-interaction.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('grapheme width, wrapping and clipping preserve CJK, emoji and combining text', () => {
    const samples = ['中', '👩🏽‍💻', 'e\u0301', '🏳️‍🌈'];
    assert.deepEqual(samples.map(getDisplayWidth), [2, 2, 1, 2]);
    assert.deepEqual(samples.map(value => graphemes(value).length), [1, 1, 1, 1]);
    const text = '/tmp/带 空格/👩🏽‍💻/e\u0301.txt';
    assert.deepEqual(wrapText('👩🏽‍💻', 1), ['…']);
    for (const width of [4, 8, 12, 20]) {
        for (const visible of [truncateFromLeft(text, width), truncateFromRight(text, width)]) {
            assert.ok(getDisplayWidth(visible) <= width);
            assert.equal(visible.includes('\u200d') && !visible.includes('👩🏽‍💻'), false);
            assert.equal(visible.includes('\u0301') && !visible.includes('e\u0301'), false);
        }
        for (const line of wrapText(text, width)) {
            assert.ok(getDisplayWidth(line) <= width);
            assert.equal(line.includes('\u200d') && !line.includes('👩🏽‍💻'), false);
        }
    }
});

test('single-line editor moves by grapheme and isolates Tab, q and y from page controls', () => {
    let state = {value: '中👩🏽‍💻e\u0301', cursor: 3};
    state = editText(state, '', {leftArrow: true});
    assert.equal(state.cursor, 2);
    state = editText(state, '', {backspace: true});
    assert.deepEqual(state, {value: '中e\u0301', cursor: 1, handled: true});
    state = editText(state, 'q y');
    assert.equal(state.value, '中q ye\u0301');
    state = editText(state, '', {home: true});
    state = editText(state, '', {delete: true});
    assert.equal(state.value, 'q ye\u0301');
    state = editText(state, '', {end: true});
    assert.equal(state.cursor, 4);
    state = editText(state, '\t', {tab: true});
    assert.equal(state.handled, false);
    assert.equal(state.value, 'q ye\u0301');
    state = editText(state, 'u', {ctrl: true});
    assert.deepEqual(state, {value: '', cursor: 0, handled: true});
});

test('long editor viewport follows the cursor and secret text remains hidden', () => {
    const value = '/tmp/带 空格/👩🏽‍💻/file.txt';
    assert.match(editorViewport(value, graphemes(value).length, 10), /█/u);
    assert.ok(getDisplayWidth(editorViewport(value, graphemes(value).length, 10)) <= 10);
    assert.ok(getDisplayWidth(editorViewport(value, 0, 10)) <= 10);
    const secret = editorViewport('svmcp_sensitive-key', 6, 10, {secret: true});
    assert.doesNotMatch(secret, /svmcp|sensitive|key/u);
    assert.match(secret, /●/u);
});

test('reverse page movement wraps and packaged helpers match the maintained source', () => {
    assert.equal(nextTabIndex(0, 6, {shift: true}), 5);
    assert.equal(nextTabIndex(5, 6, {}), 0);
    const source = fs.readFileSync(path.join(root, 'lib/tui/shared-interaction.js'));
    for (const plugin of ['loc', 'image-compress', 'gstore', 'pzip', 'slothvault']) {
        assert.ok(fs.readFileSync(path.join(root, 'plugins', plugin, 'lib/shared-interaction.js')).equals(source), plugin);
    }
});

test('status text and symbols remain visible without terminal colors', () => {
    const script = `import React from 'react';
import {Text, renderToString} from 'ink';
import {statusSymbol} from './lib/tui/shared-interaction.js';
process.stdout.write(renderToString(React.createElement(Text, {color: 'red'},
    statusSymbol('failure', 'error') + ' 失败: long error persists'), {columns: 70}));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: root, encoding: 'utf8', env: {...process.env, NO_COLOR: '1', FORCE_COLOR: '0'}
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /✕.*失败.*long error persists/u);
    assert.doesNotMatch(result.stdout, /\u001b\[[0-9;]*m/u);
});
