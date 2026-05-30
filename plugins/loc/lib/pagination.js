/**
 * @file LocPagination
 * @project SlothTool
 * @module LOC Plugin / TUI
 * @description 为 loc TUI 的扩展名与排除目录列表提供固定分页与跨页选择辅助。
 * @logic 1. 以固定页大小计算页码与可见窗口；2. 支持上下移动时自动跨页；3. 支持按页切换并尽量保持同一行位置。
 * @dependencies None
 * @index_tags loc分页, TUI列表, 翻页, 选择状态
 * @author holic512
 */

export const PAGE_SIZE = 10;

function getSafeTotalItems(totalItems) {
    return Math.max(0, Number.parseInt(totalItems, 10) || 0);
}

function clampIndex(index, totalItems) {
    if (totalItems <= 0) {
        return 0;
    }

    if (index < 0) {
        return 0;
    }

    if (index >= totalItems) {
        return totalItems - 1;
    }

    return index;
}

export function getPageCount(totalItems, pageSize = PAGE_SIZE) {
    const safeTotal = getSafeTotalItems(totalItems);
    return safeTotal === 0 ? 1 : Math.ceil(safeTotal / pageSize);
}

export function createPagedState(selectedIndex, totalItems, pageSize = PAGE_SIZE) {
    const safeTotal = getSafeTotalItems(totalItems);
    const nextSelectedIndex = clampIndex(selectedIndex, safeTotal);
    const pageCount = getPageCount(safeTotal, pageSize);
    const pageIndex = safeTotal === 0 ? 0 : Math.floor(nextSelectedIndex / pageSize);

    return {
        selectedIndex: nextSelectedIndex,
        pageIndex,
        pageCount
    };
}

export function getPagedItems(items, selectedIndex, pageSize = PAGE_SIZE) {
    const state = createPagedState(selectedIndex, items.length, pageSize);
    const startIndex = state.pageIndex * pageSize;

    return {
        ...state,
        startIndex,
        items: items.slice(startIndex, startIndex + pageSize)
    };
}

export function movePagedSelection(selectedIndex, delta, totalItems, pageSize = PAGE_SIZE) {
    const safeTotal = getSafeTotalItems(totalItems);

    if (safeTotal <= 0) {
        return createPagedState(0, safeTotal, pageSize);
    }

    const currentIndex = clampIndex(selectedIndex, safeTotal);
    const nextIndex = (currentIndex + delta + safeTotal) % safeTotal;
    return createPagedState(nextIndex, safeTotal, pageSize);
}

export function flipPagedPage(selectedIndex, delta, totalItems, pageSize = PAGE_SIZE) {
    const safeTotal = getSafeTotalItems(totalItems);

    if (safeTotal <= 0) {
        return createPagedState(0, safeTotal, pageSize);
    }

    const currentState = createPagedState(selectedIndex, safeTotal, pageSize);
    const rowOffset = currentState.selectedIndex % pageSize;
    const nextPageIndex = (currentState.pageIndex + delta + currentState.pageCount) % currentState.pageCount;
    const pageStart = nextPageIndex * pageSize;
    const pageEnd = Math.min(pageStart + pageSize - 1, safeTotal - 1);
    const nextSelectedIndex = Math.min(pageStart + rowOffset, pageEnd);

    return createPagedState(nextSelectedIndex, safeTotal, pageSize);
}

export default {
    createPagedState,
    flipPagedPage,
    getPageCount,
    getPagedItems,
    movePagedSelection,
    PAGE_SIZE
};
