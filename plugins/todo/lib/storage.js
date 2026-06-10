/**
 * @file TodoStorage
 * @project SlothTool
 * @module Todo Plugin / Storage
 * @description 管理 todo 插件的 JSON 文件数据布局、任务读写、列表读写和可同步配置。
 * @logic 1. 固定 ~/.slothtool/data/todo/default 为数据根目录；2. 每条任务按年月拆分为独立 JSON 文件；3. 实时扫描 JSON 文件生成任务与列表视图。
 * @dependencies Node: fs/os/path
 * @index_tags todo存储, JSON任务, 拆分存储, gstore数据目录
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INTERNAL_FILE_PATH = Symbol('todoFilePath');
const INTERNAL_RELATIVE_PATH = Symbol('todoRelativePath');

export function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

export function getSlothToolDataDir() {
    return path.join(getSlothToolHome(), 'data');
}

export function getTodoDataDir() {
    return path.join(getSlothToolDataDir(), 'todo', 'default');
}

export function getTasksDir() {
    return path.join(getTodoDataDir(), 'tasks');
}

export function getListsDir() {
    return path.join(getTodoDataDir(), 'lists');
}

export function getTodoConfigPath() {
    return path.join(getSlothToolDataDir(), 'plugin-configs', 'todo.json');
}

export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

export function getDefaultConfig() {
    return {
        defaultListId: 'default',
        autoSyncOnStart: false,
        autoSyncAfterWrite: false,
        defaultSort: 'due'
    };
}

export function getDefaultList() {
    const now = new Date().toISOString();
    return {
        id: 'default',
        title: 'Default',
        description: '',
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        order: 0
    };
}

function safeJsonParse(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    ensureDir(path.dirname(filePath));
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, filePath);
}

function toPortablePath(filePath) {
    return filePath.split(path.sep).join('/');
}

function normalizeArray(value) {
    if (!value) {
        return [];
    }

    const items = Array.isArray(value) ? value : [value];
    return [...new Set(items
        .flatMap(item => String(item).split(','))
        .map(item => item.trim())
        .filter(Boolean))];
}

function normalizeNullableString(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return String(value);
}

function normalizeInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProgress(value) {
    const parsed = normalizeInteger(value, 0);
    return Math.max(0, Math.min(parsed, 100));
}

function normalizeChecklist(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(item => ({
        id: String(item.id || ''),
        title: String(item.title || ''),
        done: Boolean(item.done),
        createdAt: item.createdAt || new Date().toISOString(),
        completedAt: item.completedAt || null
    })).filter(item => item.id && item.title);
}

function normalizeNotes(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(item => ({
        id: String(item.id || ''),
        text: String(item.text || ''),
        createdAt: item.createdAt || new Date().toISOString()
    })).filter(item => item.id && item.text);
}

function normalizeLinks(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(item => {
        if (typeof item === 'string') {
            return {url: item, title: ''};
        }

        return {
            url: String(item.url || ''),
            title: String(item.title || '')
        };
    }).filter(item => item.url);
}

export function normalizeTask(input = {}) {
    const now = new Date().toISOString();

    return {
        schemaVersion: 1,
        id: String(input.id || ''),
        title: String(input.title || '').trim(),
        description: String(input.description || ''),
        status: String(input.status || 'todo'),
        priority: String(input.priority || 'medium'),
        listId: String(input.listId || 'default'),
        project: String(input.project || ''),
        area: String(input.area || ''),
        tags: normalizeArray(input.tags),
        contexts: normalizeArray(input.contexts),
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || input.createdAt || now,
        startAt: normalizeNullableString(input.startAt),
        scheduledAt: normalizeNullableString(input.scheduledAt),
        dueAt: normalizeNullableString(input.dueAt),
        completedAt: normalizeNullableString(input.completedAt),
        archivedAt: normalizeNullableString(input.archivedAt),
        deletedAt: normalizeNullableString(input.deletedAt),
        estimateMinutes: normalizeInteger(input.estimateMinutes, 0),
        spentMinutes: normalizeInteger(input.spentMinutes, 0),
        progress: normalizeProgress(input.progress),
        order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
        parentId: String(input.parentId || ''),
        checklist: normalizeChecklist(input.checklist),
        notes: normalizeNotes(input.notes),
        links: normalizeLinks(input.links),
        recurrence: input.recurrence && typeof input.recurrence === 'object' ? input.recurrence : null
    };
}

export function normalizeList(input = {}) {
    const now = new Date().toISOString();

    return {
        id: String(input.id || '').trim(),
        title: String(input.title || '').trim(),
        description: String(input.description || ''),
        archivedAt: normalizeNullableString(input.archivedAt),
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || input.createdAt || now,
        order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0
    };
}

export function slugifyId(value, fallback = 'item') {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/gu, '-')
        .replace(/^-+|-+$/gu, '');

    return slug || fallback;
}

export function ensureTodoStorage() {
    ensureDir(getTasksDir());
    ensureDir(getListsDir());
    ensureDir(path.dirname(getTodoConfigPath()));

    if (!fs.existsSync(getTodoConfigPath())) {
        writeJson(getTodoConfigPath(), getDefaultConfig());
    }

    const defaultListPath = getListPath('default');
    if (!fs.existsSync(defaultListPath)) {
        writeJson(defaultListPath, getDefaultList());
    }
}

export function readConfig() {
    ensureTodoStorage();
    const parsed = safeJsonParse(getTodoConfigPath());

    return {
        ...getDefaultConfig(),
        ...parsed
    };
}

export function writeConfig(config) {
    ensureTodoStorage();
    const nextConfig = {
        ...getDefaultConfig(),
        ...config
    };
    writeJson(getTodoConfigPath(), nextConfig);
    return nextConfig;
}

export function getListPath(listId) {
    return path.join(getListsDir(), `${slugifyId(listId, 'default')}.json`);
}

export function readLists(options = {}) {
    ensureTodoStorage();
    const lists = [];

    for (const entry of fs.readdirSync(getListsDir(), {withFileTypes: true})) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
            continue;
        }

        const list = normalizeList(safeJsonParse(path.join(getListsDir(), entry.name)));
        if (list.id && (options.includeArchived || !list.archivedAt)) {
            lists.push(list);
        }
    }

    return lists.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export function readList(listId) {
    ensureTodoStorage();
    const filePath = getListPath(listId);
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return normalizeList(safeJsonParse(filePath));
}

export function saveList(list) {
    ensureTodoStorage();
    const normalized = normalizeList({
        ...list,
        updatedAt: new Date().toISOString()
    });
    writeJson(getListPath(normalized.id), normalized);
    return normalized;
}

export function ensureList(listId, title = listId) {
    const id = slugifyId(listId || 'default', 'default');
    const existing = readList(id);
    if (existing) {
        return existing;
    }

    return saveList({
        id,
        title: title || id,
        description: '',
        archivedAt: null,
        createdAt: new Date().toISOString(),
        order: readLists({includeArchived: true}).length
    });
}

function visitJsonFiles(rootDir, onFile) {
    if (!fs.existsSync(rootDir)) {
        return;
    }

    for (const entry of fs.readdirSync(rootDir, {withFileTypes: true}).sort((left, right) => left.name.localeCompare(right.name))) {
        const currentPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            visitJsonFiles(currentPath, onFile);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
            onFile(currentPath);
        }
    }
}

export function getTaskPath(task) {
    if (task?.[INTERNAL_FILE_PATH]) {
        return task[INTERNAL_FILE_PATH];
    }

    const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
    const year = Number.isNaN(createdAt.getTime()) ? 'unknown' : String(createdAt.getFullYear());
    const month = Number.isNaN(createdAt.getTime()) ? 'unknown' : String(createdAt.getMonth() + 1).padStart(2, '0');
    return path.join(getTasksDir(), year, month, `${task.id}.json`);
}

export function readTasks() {
    ensureTodoStorage();
    const tasks = [];

    visitJsonFiles(getTasksDir(), filePath => {
        const task = normalizeTask(safeJsonParse(filePath));
        Object.defineProperty(task, INTERNAL_FILE_PATH, {value: filePath});
        Object.defineProperty(task, INTERNAL_RELATIVE_PATH, {value: toPortablePath(path.relative(getTodoDataDir(), filePath))});
        tasks.push(task);
    });

    return tasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function saveTask(task) {
    ensureTodoStorage();
    const normalized = normalizeTask({
        ...task,
        updatedAt: new Date().toISOString()
    });
    writeJson(getTaskPath(task), normalized);
    return normalized;
}

export function removeTask(task) {
    const filePath = getTaskPath(task);
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, {force: true});
    }
}

export function getTaskRelativePath(task) {
    if (task?.[INTERNAL_RELATIVE_PATH]) {
        return task[INTERNAL_RELATIVE_PATH];
    }

    return toPortablePath(path.relative(getTodoDataDir(), getTaskPath(task)));
}

export default {
    ensureList,
    ensureTodoStorage,
    getDefaultConfig,
    getListPath,
    getListsDir,
    getSlothToolDataDir,
    getTaskPath,
    getTaskRelativePath,
    getTasksDir,
    getTodoConfigPath,
    getTodoDataDir,
    normalizeTask,
    readConfig,
    readList,
    readLists,
    readTasks,
    removeTask,
    saveList,
    saveTask,
    slugifyId,
    writeConfig
};
