/**
 * @file TodoService
 * @project SlothTool
 * @module Todo Plugin / Services
 * @description 提供 TodoList 任务、列表、标签、项目、统计和 gstore 手动同步的核心业务能力。
 * @logic 1. 基于独立 JSON 文件创建和更新任务；2. 支持状态流转、软删除、checklist 与 note；3. 复用 gstore 桥接执行同步相关操作。
 * @dependencies Node: crypto, Storage: ./storage.js, Filter: ./filter.js, Sync: ./sync.js
 * @index_tags todo服务, 任务管理, checklist, note, gstore同步
 * @author holic512
 */

import crypto from 'node:crypto';
import {filterTasks, getProjects, getTags, getTaskStats} from './filter.js';
import {
    ensureList,
    ensureTodoStorage,
    getTaskRelativePath,
    getTodoDataDir,
    readConfig,
    readList,
    readLists,
    readTasks,
    removeTask,
    saveList,
    saveTask,
    slugifyId,
    writeConfig
} from './storage.js';
import {getGStoreDoctor, runGStoreAction} from './sync.js';

export const VALID_STATUSES = ['todo', 'in-progress', 'blocked', 'done', 'archived', 'deleted'];
export const VALID_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];

export class TodoError extends Error {
    constructor(message, code = 'TODO_ERROR', details = {}) {
        super(message);
        this.name = 'TodoError';
        this.code = code;
        this.details = details;
    }
}

function nowIso() {
    return new Date().toISOString();
}

function createId() {
    return crypto.randomUUID();
}

function normalizeArray(value) {
    if (value === undefined) {
        return undefined;
    }

    const items = Array.isArray(value) ? value : [value];
    return [...new Set(items
        .flatMap(item => String(item).split(','))
        .map(item => item.trim())
        .filter(Boolean))];
}

function nullableString(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    return String(value);
}

function integerValue(value, fieldName) {
    if (value === undefined) {
        return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        throw new TodoError(`${fieldName} must be a number.`, 'TODO_INVALID_NUMBER', {fieldName});
    }

    return parsed;
}

function progressValue(value) {
    const parsed = integerValue(value, 'progress');
    if (parsed === undefined) {
        return undefined;
    }

    return Math.max(0, Math.min(parsed, 100));
}

function assertPriority(priority) {
    if (!VALID_PRIORITIES.includes(priority)) {
        throw new TodoError(`Invalid priority: ${priority}`, 'TODO_INVALID_PRIORITY', {
            valid: VALID_PRIORITIES
        });
    }
}

function assertStatus(status) {
    if (!VALID_STATUSES.includes(status)) {
        throw new TodoError(`Invalid status: ${status}`, 'TODO_INVALID_STATUS', {
            valid: VALID_STATUSES
        });
    }
}

function serializeTask(task) {
    return {
        ...task,
        relativePath: getTaskRelativePath(task)
    };
}

export function initializeTodo() {
    ensureTodoStorage();
    return {
        dataDir: getTodoDataDir(),
        config: readConfig(),
        lists: readLists({includeArchived: true})
    };
}

export function listTasks(options = {}) {
    ensureTodoStorage();
    return filterTasks(readTasks(), options);
}

export function listAllTasks() {
    ensureTodoStorage();
    return readTasks();
}

export function findTaskByPrefix(prefix, options = {}) {
    ensureTodoStorage();
    const normalizedPrefix = String(prefix || '').trim().toLowerCase();
    if (!normalizedPrefix) {
        throw new TodoError('Task id prefix is required.', 'TODO_TASK_ID_REQUIRED');
    }

    const candidates = readTasks().filter(task => {
        if (!options.includeDeleted && task.deletedAt) {
            return false;
        }

        return task.id.toLowerCase() === normalizedPrefix || task.id.toLowerCase().startsWith(normalizedPrefix);
    });

    const exact = candidates.find(task => task.id.toLowerCase() === normalizedPrefix);
    if (exact) {
        return exact;
    }

    if (candidates.length === 0) {
        throw new TodoError(`Task not found: ${prefix}`, 'TODO_TASK_NOT_FOUND', {prefix});
    }

    if (candidates.length > 1) {
        throw new TodoError(
            `Task id prefix is ambiguous: ${prefix} (${candidates.map(task => task.id.slice(0, 8)).join(', ')})`,
            'TODO_TASK_AMBIGUOUS',
            {prefix, matches: candidates.map(task => task.id)}
        );
    }

    return candidates[0];
}

function applyTaskChanges(task, changes = {}) {
    const nextTask = {...task};

    if (changes.title !== undefined) {
        const title = String(changes.title).trim();
        if (!title) {
            throw new TodoError('Task title is required.', 'TODO_TITLE_REQUIRED');
        }
        nextTask.title = title;
    }

    if (changes.description !== undefined) {
        nextTask.description = String(changes.description || '');
    }

    if (changes.status !== undefined) {
        assertStatus(changes.status);
        nextTask.status = changes.status;
    }

    if (changes.priority !== undefined) {
        assertPriority(changes.priority);
        nextTask.priority = changes.priority;
    }

    if (changes.listId !== undefined) {
        const listId = slugifyId(changes.listId || 'default', 'default');
        ensureList(listId, listId);
        nextTask.listId = listId;
    }

    for (const field of ['project', 'area', 'parentId']) {
        if (changes[field] !== undefined) {
            nextTask[field] = String(changes[field] || '');
        }
    }

    const tags = normalizeArray(changes.tags);
    if (tags !== undefined) {
        nextTask.tags = tags;
    }

    const contexts = normalizeArray(changes.contexts);
    if (contexts !== undefined) {
        nextTask.contexts = contexts;
    }

    for (const field of ['startAt', 'scheduledAt', 'dueAt', 'completedAt', 'archivedAt', 'deletedAt']) {
        const value = nullableString(changes[field]);
        if (value !== undefined) {
            nextTask[field] = value;
        }
    }

    for (const [field, label] of [
        ['estimateMinutes', 'estimateMinutes'],
        ['spentMinutes', 'spentMinutes']
    ]) {
        const value = integerValue(changes[field], label);
        if (value !== undefined) {
            nextTask[field] = Math.max(0, value);
        }
    }

    const progress = progressValue(changes.progress);
    if (progress !== undefined) {
        nextTask.progress = progress;
    }

    if (changes.links !== undefined) {
        nextTask.links = normalizeArray(changes.links).map(url => ({url, title: ''}));
    }

    if (changes.recurrence !== undefined) {
        nextTask.recurrence = changes.recurrence || null;
    }

    return nextTask;
}

export function createTask(title, options = {}) {
    ensureTodoStorage();
    const trimmedTitle = String(title || '').trim();
    if (!trimmedTitle) {
        throw new TodoError('Task title is required.', 'TODO_TITLE_REQUIRED');
    }

    const createdAt = nowIso();
    const listId = slugifyId(options.listId || options.list || readConfig().defaultListId || 'default', 'default');
    ensureList(listId, listId);

    const task = applyTaskChanges({
        id: createId(),
        title: trimmedTitle,
        description: '',
        status: 'todo',
        priority: 'medium',
        listId,
        project: '',
        area: '',
        tags: [],
        contexts: [],
        createdAt,
        updatedAt: createdAt,
        startAt: null,
        scheduledAt: null,
        dueAt: null,
        completedAt: null,
        archivedAt: null,
        deletedAt: null,
        estimateMinutes: 0,
        spentMinutes: 0,
        progress: 0,
        order: Date.now(),
        parentId: '',
        checklist: [],
        notes: [],
        links: [],
        recurrence: null
    }, {
        description: options.description,
        priority: options.priority,
        project: options.project,
        area: options.area,
        tags: options.tags,
        contexts: options.contexts,
        dueAt: options.dueAt || options.due,
        scheduledAt: options.scheduledAt || options.scheduled,
        startAt: options.startAt || options.start,
        estimateMinutes: options.estimateMinutes || options.estimate,
        spentMinutes: options.spentMinutes || options.spent,
        progress: options.progress,
        parentId: options.parentId || options.parent,
        links: options.links
    });

    return saveTask(task);
}

export function updateTask(prefix, changes = {}) {
    const task = findTaskByPrefix(prefix, {includeDeleted: true});
    return saveTask(applyTaskChanges(task, changes));
}

export function setTaskStatus(prefix, status) {
    assertStatus(status);
    const task = findTaskByPrefix(prefix, {includeDeleted: true});
    const timestamp = nowIso();
    const nextTask = {...task, status};

    if (status === 'done') {
        nextTask.completedAt = timestamp;
        nextTask.progress = 100;
    } else if (status === 'todo') {
        nextTask.completedAt = null;
        nextTask.archivedAt = null;
        nextTask.deletedAt = null;
        nextTask.progress = task.progress === 100 ? 0 : task.progress;
    } else if (status === 'in-progress') {
        nextTask.startAt = task.startAt || timestamp;
        nextTask.completedAt = null;
        nextTask.deletedAt = null;
        nextTask.archivedAt = null;
    } else if (status === 'archived') {
        nextTask.archivedAt = timestamp;
        nextTask.deletedAt = null;
    } else if (status === 'deleted') {
        nextTask.deletedAt = timestamp;
    }

    return saveTask(nextTask);
}

export function restoreTask(prefix) {
    return setTaskStatus(prefix, 'todo');
}

export function purgeTask(prefix) {
    const task = findTaskByPrefix(prefix, {includeDeleted: true});
    const serialized = serializeTask(task);
    removeTask(task);
    return serialized;
}

export function mutateMany(prefixes, action) {
    if (!Array.isArray(prefixes) || prefixes.length === 0) {
        throw new TodoError('At least one task id prefix is required.', 'TODO_TASK_ID_REQUIRED');
    }

    return prefixes.map(prefix => action(prefix));
}

function findChecklistItem(task, itemPrefix) {
    const prefix = String(itemPrefix || '').trim().toLowerCase();
    const matches = task.checklist.filter(item => item.id.toLowerCase() === prefix || item.id.toLowerCase().startsWith(prefix));
    const exact = matches.find(item => item.id.toLowerCase() === prefix);

    if (exact) {
        return exact;
    }

    if (matches.length === 0) {
        throw new TodoError(`Checklist item not found: ${itemPrefix}`, 'TODO_CHECKLIST_NOT_FOUND');
    }

    if (matches.length > 1) {
        throw new TodoError(`Checklist item prefix is ambiguous: ${itemPrefix}`, 'TODO_CHECKLIST_AMBIGUOUS');
    }

    return matches[0];
}

export function addChecklistItem(taskPrefix, title) {
    const task = findTaskByPrefix(taskPrefix, {includeDeleted: true});
    const itemTitle = String(title || '').trim();
    if (!itemTitle) {
        throw new TodoError('Checklist item title is required.', 'TODO_CHECKLIST_TITLE_REQUIRED');
    }

    const nextTask = {
        ...task,
        checklist: [
            ...task.checklist,
            {
                id: createId(),
                title: itemTitle,
                done: false,
                createdAt: nowIso(),
                completedAt: null
            }
        ]
    };

    return saveTask(nextTask);
}

export function setChecklistItemDone(taskPrefix, itemPrefix, done) {
    const task = findTaskByPrefix(taskPrefix, {includeDeleted: true});
    const item = findChecklistItem(task, itemPrefix);
    const nextTask = {
        ...task,
        checklist: task.checklist.map(current => current.id === item.id
            ? {
                ...current,
                done: Boolean(done),
                completedAt: done ? nowIso() : null
            }
            : current)
    };

    return saveTask(nextTask);
}

export function removeChecklistItem(taskPrefix, itemPrefix) {
    const task = findTaskByPrefix(taskPrefix, {includeDeleted: true});
    const item = findChecklistItem(task, itemPrefix);
    const nextTask = {
        ...task,
        checklist: task.checklist.filter(current => current.id !== item.id)
    };

    return saveTask(nextTask);
}

export function addNote(taskPrefix, text) {
    const task = findTaskByPrefix(taskPrefix, {includeDeleted: true});
    const noteText = String(text || '').trim();
    if (!noteText) {
        throw new TodoError('Note text is required.', 'TODO_NOTE_REQUIRED');
    }

    const nextTask = {
        ...task,
        notes: [
            ...task.notes,
            {
                id: createId(),
                text: noteText,
                createdAt: nowIso()
            }
        ]
    };

    return saveTask(nextTask);
}

export function listNotes(taskPrefix) {
    return findTaskByPrefix(taskPrefix, {includeDeleted: true}).notes;
}

export function listTaskLists(options = {}) {
    return readLists({includeArchived: options.all || options.includeArchived});
}

export function createTaskList(title, options = {}) {
    const listTitle = String(title || '').trim();
    if (!listTitle) {
        throw new TodoError('List title is required.', 'TODO_LIST_TITLE_REQUIRED');
    }

    const id = slugifyId(options.id || listTitle, 'list');
    if (readList(id)) {
        throw new TodoError(`List already exists: ${id}`, 'TODO_LIST_EXISTS', {id});
    }

    return saveList({
        id,
        title: listTitle,
        description: options.description || '',
        archivedAt: null,
        createdAt: nowIso(),
        order: readLists({includeArchived: true}).length
    });
}

export function renameTaskList(listId, title) {
    const list = readList(listId);
    if (!list) {
        throw new TodoError(`List not found: ${listId}`, 'TODO_LIST_NOT_FOUND', {listId});
    }

    return saveList({
        ...list,
        title: String(title || '').trim() || list.title
    });
}

export function archiveTaskList(listId) {
    if (listId === 'default') {
        throw new TodoError('Default list cannot be archived.', 'TODO_DEFAULT_LIST_ARCHIVE');
    }

    const list = readList(listId);
    if (!list) {
        throw new TodoError(`List not found: ${listId}`, 'TODO_LIST_NOT_FOUND', {listId});
    }

    return saveList({
        ...list,
        archivedAt: nowIso()
    });
}

export function getTodoSummary() {
    const tasks = readTasks();
    return {
        dataDir: getTodoDataDir(),
        config: readConfig(),
        lists: readLists({includeArchived: true}),
        stats: getTaskStats(tasks),
        tags: getTags(tasks),
        projects: getProjects(tasks)
    };
}

export function getTaskTags() {
    return getTags(readTasks());
}

export function getTaskProjects() {
    return getProjects(readTasks());
}

export function getStats() {
    return getTaskStats(readTasks());
}

export function updateTodoConfig(config) {
    return writeConfig({
        ...readConfig(),
        ...config
    });
}

export function runSyncAction(action) {
    if (action === 'doctor') {
        return getGStoreDoctor();
    }

    return runGStoreAction(action);
}

export function toTaskOutput(task) {
    return serializeTask(task);
}

export default {
    addChecklistItem,
    addNote,
    archiveTaskList,
    createTask,
    createTaskList,
    findTaskByPrefix,
    getStats,
    getTaskProjects,
    getTaskTags,
    getTodoSummary,
    initializeTodo,
    listAllTasks,
    listNotes,
    listTaskLists,
    listTasks,
    mutateMany,
    purgeTask,
    removeChecklistItem,
    renameTaskList,
    restoreTask,
    runSyncAction,
    setChecklistItemDone,
    setTaskStatus,
    toTaskOutput,
    updateTask,
    updateTodoConfig
};
