/**
 * @file TodoFilterService
 * @project SlothTool
 * @module Todo Plugin / Filtering
 * @description 提供任务筛选、排序、聚合和日期窗口判断能力，供 CLI 与 TUI 共用。
 * @logic 1. 按状态、标签、项目、列表和 due 窗口过滤任务；2. 提供稳定排序；3. 汇总标签、项目和统计信息。
 * @dependencies None
 * @index_tags todo筛选, due过滤, tag, project, stats
 * @author holic512
 */

const PRIORITY_RANK = {
    urgent: 5,
    high: 4,
    medium: 3,
    low: 2,
    none: 1
};

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
}

function parseDate(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinDueWindow(task, dueFilter, now = new Date()) {
    if (!dueFilter) {
        return true;
    }

    const dueAt = parseDate(task.dueAt);
    if (!dueAt) {
        return false;
    }

    const today = startOfDay(now);
    const dueDay = startOfDay(dueAt);

    if (dueFilter === 'overdue') {
        return dueDay < today && task.status !== 'done';
    }

    if (dueFilter === 'today') {
        return dueDay.getTime() === today.getTime();
    }

    if (dueFilter === 'week') {
        return dueDay >= today && dueDay < addDays(today, 7);
    }

    const explicitDate = parseDate(dueFilter);
    return explicitDate ? dueDay.getTime() === startOfDay(explicitDate).getTime() : false;
}

function compareDate(left, right, field, emptyLast = true) {
    const leftValue = parseDate(left[field])?.getTime();
    const rightValue = parseDate(right[field])?.getTime();

    if (leftValue === undefined && rightValue === undefined) {
        return 0;
    }

    if (leftValue === undefined) {
        return emptyLast ? 1 : -1;
    }

    if (rightValue === undefined) {
        return emptyLast ? -1 : 1;
    }

    return leftValue - rightValue;
}

export function sortTasks(tasks, sort = 'due') {
    const nextTasks = [...tasks];

    nextTasks.sort((left, right) => {
        if (sort === 'priority') {
            return (PRIORITY_RANK[right.priority] || 0) - (PRIORITY_RANK[left.priority] || 0) ||
                compareDate(left, right, 'dueAt') ||
                left.createdAt.localeCompare(right.createdAt);
        }

        if (sort === 'created') {
            return left.createdAt.localeCompare(right.createdAt);
        }

        if (sort === 'updated') {
            return right.updatedAt.localeCompare(left.updatedAt);
        }

        return compareDate(left, right, 'dueAt') ||
            (PRIORITY_RANK[right.priority] || 0) - (PRIORITY_RANK[left.priority] || 0) ||
            left.createdAt.localeCompare(right.createdAt);
    });

    return nextTasks;
}

export function filterTasks(tasks, options = {}) {
    const tagFilters = Array.isArray(options.tags) ? options.tags : (options.tag ? [options.tag] : []);
    const contextFilters = Array.isArray(options.contexts) ? options.contexts : (options.context ? [options.context] : []);
    const query = String(options.query || '').trim().toLowerCase();

    const filtered = tasks.filter(task => {
        if (!options.all && task.deletedAt) {
            return false;
        }

        if (!options.all && task.status === 'archived') {
            return false;
        }

        if (options.status && task.status !== options.status) {
            return false;
        }

        if (options.list && task.listId !== options.list) {
            return false;
        }

        if (options.project && task.project !== options.project) {
            return false;
        }

        if (options.area && task.area !== options.area) {
            return false;
        }

        if (tagFilters.length > 0 && !tagFilters.every(tag => task.tags.includes(tag))) {
            return false;
        }

        if (contextFilters.length > 0 && !contextFilters.every(context => task.contexts.includes(context))) {
            return false;
        }

        if (!isWithinDueWindow(task, options.due, options.now)) {
            return false;
        }

        if (query) {
            const haystack = [
                task.title,
                task.description,
                task.project,
                task.area,
                ...task.tags,
                ...task.contexts,
                ...task.notes.map(note => note.text)
            ].join('\n').toLowerCase();
            return haystack.includes(query);
        }

        return true;
    });

    return sortTasks(filtered, options.sort || 'due');
}

export function getTags(tasks) {
    return [...new Set(tasks.flatMap(task => task.tags))].sort((left, right) => left.localeCompare(right));
}

export function getProjects(tasks) {
    return [...new Set(tasks.map(task => task.project).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function getTaskStats(tasks) {
    const visibleTasks = tasks.filter(task => !task.deletedAt);
    const byStatus = {};
    const byPriority = {};

    for (const task of visibleTasks) {
        byStatus[task.status] = (byStatus[task.status] || 0) + 1;
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    }

    const overdue = filterTasks(visibleTasks, {due: 'overdue', all: true}).length;
    const today = filterTasks(visibleTasks, {due: 'today', all: true}).length;

    return {
        total: visibleTasks.length,
        open: visibleTasks.filter(task => !['done', 'archived', 'deleted'].includes(task.status)).length,
        done: visibleTasks.filter(task => task.status === 'done').length,
        archived: visibleTasks.filter(task => task.status === 'archived').length,
        overdue,
        today,
        byStatus,
        byPriority
    };
}

export default {
    filterTasks,
    getProjects,
    getTags,
    getTaskStats,
    sortTasks
};
