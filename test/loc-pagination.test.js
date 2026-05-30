/**
 * @file LocPaginationTest
 * @project SlothTool
 * @module Test / LOC Plugin
 * @description 验证 loc TUI 分页辅助函数的页码、跨页移动与可见窗口计算。
 * @logic 1. 覆盖 10 项一页的页数计算；2. 校验上下移动时自动跨页；3. 校验显式翻页时尽量保持同一行位置。
 * @dependencies Pagination: ../plugins/loc/lib/pagination.js, Node: assert/test
 * @index_tags loc分页测试, 翻页, 选择状态, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    flipPagedPage,
    getPageCount,
    getPagedItems,
    movePagedSelection
} from '../plugins/loc/lib/pagination.js';

test('loc pagination uses 10 items per page', () => {
    assert.equal(getPageCount(0), 1);
    assert.equal(getPageCount(10), 1);
    assert.equal(getPageCount(11), 2);
    assert.equal(getPageCount(25), 3);
});

test('loc pagination moves across page boundaries with Up/Down', () => {
    const downState = movePagedSelection(9, 1, 25);
    const upState = movePagedSelection(10, -1, 25);

    assert.equal(downState.selectedIndex, 10);
    assert.equal(downState.pageIndex, 1);
    assert.equal(upState.selectedIndex, 9);
    assert.equal(upState.pageIndex, 0);
});

test('loc pagination flips pages while preserving row offset when possible', () => {
    const nextPageState = flipPagedPage(13, 1, 25);
    const previousPageState = flipPagedPage(23, -1, 25);

    assert.equal(nextPageState.selectedIndex, 23);
    assert.equal(nextPageState.pageIndex, 2);
    assert.equal(previousPageState.selectedIndex, 13);
    assert.equal(previousPageState.pageIndex, 1);
});

test('loc pagination returns the visible page window and start index', () => {
    const items = Array.from({length: 25}, (_, index) => ({name: `item-${index}`, enabled: true}));
    const page = getPagedItems(items, 12);

    assert.equal(page.pageIndex, 1);
    assert.equal(page.pageCount, 3);
    assert.equal(page.startIndex, 10);
    assert.equal(page.items.length, 10);
    assert.equal(page.items[0].name, 'item-10');
    assert.equal(page.items[9].name, 'item-19');
});
