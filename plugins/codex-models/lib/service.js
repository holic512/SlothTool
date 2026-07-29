/**
 * @file CodexModelsService
 * @project SlothTool
 * @module Codex Models Plugin / Service
 * @description 读取 Codex 自定义 provider 配置，合并跨厂商模型元数据库，安全同步模型目录和推理等级，并生成 Desktop 模型筛选缓存的一次性离线修复脚本。
 * @logic 1. 解析 ~/.codex 配置与认证位置但不输出密钥；2. 请求兼容 provider 的 /models 并合并内置跨厂商模型画像；3. 原子更新 model/model_reasoning_effort/model_catalog_json；4. 仅生成需在 Codex 退出后执行的 LevelDB 修复脚本。
 * @dependencies Node.js: fs, path, os, child_process; Model metadata: ./model-library.js; External runtime: Codex Desktop bundled classic-level (generated script only)
 * @index_tags codex, model catalog, custom provider, reasoning effort, multi-vendor model library, offline repair, statsig, desktop
 * @author holic512
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {listBuiltInProfiles, resolveModelMetadata} from './model-library.js';

const DEFAULT_CATALOG_NAME = 'slothtool-model-catalog.json';
const DEFAULT_REPAIR_DIR = path.join('.slothtool', 'data', 'codex-models');
const STATSIG_CONFIG_ID = '107580212';

function removeTomlComment(value) {
    let quote = '';
    let escaped = false;

    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (quote) {
            if (character === '\\' && !escaped) {
                escaped = true;
                continue;
            }
            if (character === quote && !escaped) {
                quote = '';
            }
            escaped = false;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
            continue;
        }
        if (character === '#') {
            return value.slice(0, index).trim();
        }
    }

    return value.trim();
}

function parseTomlValue(rawValue) {
    const value = removeTomlComment(rawValue);
    if (value.startsWith('"') && value.endsWith('"')) {
        try {
            return JSON.parse(value);
        } catch {
            return value.slice(1, -1);
        }
    }
    if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1);
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    if (/^-?\d+(?:\.\d+)?$/u.test(value)) {
        return Number(value);
    }
    return value;
}

export function parseTomlDocument(content) {
    const root = {};
    const sections = new Map();
    let current = root;

    for (const sourceLine of content.split(/\r?\n/u)) {
        const line = sourceLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const tableMatch = line.match(/^\[([^\]]+)\]$/u);
        if (tableMatch) {
            const sectionName = tableMatch[1].trim();
            if (!sections.has(sectionName)) {
                sections.set(sectionName, {});
            }
            current = sections.get(sectionName);
            continue;
        }
        const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/u);
        if (assignment) {
            current[assignment[1]] = parseTomlValue(assignment[2]);
        }
    }

    return {root, sections};
}

function stringifyTomlValue(value) {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
    }
    throw new Error(`Unsupported TOML value type: ${typeof value}`);
}

export function setTomlValue(content, sectionName, key, value) {
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/u);
    const header = sectionName ? `[${sectionName}]` : '';
    let sectionStart = sectionName ? -1 : 0;
    let sectionEnd = lines.length;

    if (sectionName) {
        sectionStart = lines.findIndex(line => line.trim() === header);
        if (sectionStart < 0) {
            const suffix = content.endsWith(newline) || content.length === 0 ? '' : newline;
            return `${content}${suffix}${header}${newline}${key} = ${stringifyTomlValue(value)}${newline}`;
        }
        for (let index = sectionStart + 1; index < lines.length; index += 1) {
            if (/^\s*\[[^\]]+\]\s*$/u.test(lines[index])) {
                sectionEnd = index;
                break;
            }
        }
    } else {
        const firstSection = lines.findIndex(line => /^\s*\[[^\]]+\]\s*$/u.test(line));
        sectionEnd = firstSection < 0 ? lines.length : firstSection;
    }

    const assignmentPattern = new RegExp(`^(\\s*${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*=\\s*)(.*)$`, 'u');
    for (let index = sectionStart; index < sectionEnd; index += 1) {
        const match = lines[index].match(assignmentPattern);
        if (match) {
            let quote = '';
            let escaped = false;
            let commentIndex = -1;
            for (let offset = 0; offset < match[2].length; offset += 1) {
                const character = match[2][offset];
                if (quote) {
                    if (character === '\\' && !escaped) {
                        escaped = true;
                        continue;
                    }
                    if (character === quote && !escaped) {
                        quote = '';
                    }
                    escaped = false;
                } else if (character === '"' || character === "'") {
                    quote = character;
                } else if (character === '#') {
                    commentIndex = offset;
                    break;
                }
            }
            const comment = commentIndex >= 0 ? match[2].slice(commentIndex).trimEnd() : '';
            lines[index] = `${match[1]}${stringifyTomlValue(value)}${comment ? ` ${comment}` : ''}`;
            return lines.join(newline);
        }
    }

    const insertAt = sectionEnd;
    lines.splice(insertAt, 0, `${key} = ${stringifyTomlValue(value)}`);
    return lines.join(newline);
}

function atomicWrite(filePath, content, mode = 0o600) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tempPath, content, {encoding: 'utf8', mode});
    fs.renameSync(tempPath, filePath);
}

function resolveCodexHome(options = {}) {
    return path.resolve(options.codexHome || process.env.CODEX_MODELS_HOME || path.join(os.homedir(), '.codex'));
}

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getProviderConfig(document) {
    const modelProvider = String(document.root.model_provider || 'openai');
    const provider = document.sections.get(`model_providers.${modelProvider}`) || {};
    return {modelProvider, provider};
}

function maskConfigured(value) {
    return value ? 'configured' : 'missing';
}

export function readCodexConfiguration(options = {}) {
    const codexHome = resolveCodexHome(options);
    const configPath = path.join(codexHome, 'config.toml');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Codex configuration was not found: ${configPath}`);
    }

    const document = parseTomlDocument(fs.readFileSync(configPath, 'utf8'));
    const {modelProvider, provider} = getProviderConfig(document);
    const authPath = path.join(codexHome, 'auth.json');
    const auth = readJsonIfExists(authPath) || {};
    const bearerToken = typeof provider.experimental_bearer_token === 'string'
        ? provider.experimental_bearer_token
        : (typeof auth.OPENAI_API_KEY === 'string' ? auth.OPENAI_API_KEY : '');

    return {
        codexHome,
        configPath,
        authPath,
        document,
        model: typeof document.root.model === 'string' ? document.root.model : '',
        reasoningEffort: typeof document.root.model_reasoning_effort === 'string' ? document.root.model_reasoning_effort : '',
        modelCatalogPath: typeof document.root.model_catalog_json === 'string' ? document.root.model_catalog_json : '',
        modelProvider,
        baseUrl: typeof provider.base_url === 'string' ? provider.base_url : '',
        wireApi: typeof provider.wire_api === 'string' ? provider.wire_api : '',
        requiresOpenAiAuth: provider.requires_openai_auth === true,
        credential: bearerToken,
        credentialStatus: maskConfigured(bearerToken)
    };
}

function buildModelsUrl(baseUrl) {
    if (!baseUrl) {
        throw new Error('The active Codex model provider does not define base_url.');
    }
    return `${baseUrl.replace(/\/+$/u, '')}/models`;
}

function safeProviderModel(item, id) {
    if (!item || typeof item !== 'object') {
        return {id};
    }
    const capabilities = item.capabilities && typeof item.capabilities === 'object'
        ? {
            context_window: item.capabilities.context_window,
            reasoning_efforts: item.capabilities.reasoning_efforts,
            effort: item.capabilities.effort,
            web_search: item.capabilities.web_search
        }
        : undefined;
    return {
        id,
        display_name: item.display_name,
        displayName: item.displayName,
        description: item.description,
        context_window: item.context_window,
        contextWindow: item.contextWindow,
        max_context_window: item.max_context_window,
        maxContextWindow: item.maxContextWindow,
        context_length: item.context_length,
        contextLength: item.contextLength,
        input_token_limit: item.input_token_limit,
        inputTokenLimit: item.inputTokenLimit,
        max_input_tokens: item.max_input_tokens,
        maxInputTokens: item.maxInputTokens,
        default_reasoning_level: item.default_reasoning_level,
        defaultReasoningEffort: item.defaultReasoningEffort,
        default_reasoning_effort: item.default_reasoning_effort,
        reasoning_effort: item.reasoning_effort,
        supported_reasoning_levels: item.supported_reasoning_levels,
        supportedReasoningEfforts: item.supportedReasoningEfforts,
        supported_reasoning_efforts: item.supported_reasoning_efforts,
        reasoning_efforts: item.reasoning_efforts,
        supports_search_tool: item.supports_search_tool,
        supportsSearchTool: item.supportsSearchTool,
        supports_parallel_tool_calls: item.supports_parallel_tool_calls,
        supportsParallelToolCalls: item.supportsParallelToolCalls,
        supports_reasoning_summaries: item.supports_reasoning_summaries,
        supportsReasoningSummaries: item.supportsReasoningSummaries,
        input_modalities: item.input_modalities,
        inputModalities: item.inputModalities,
        capabilities
    };
}

export function normalizeModelList(payload) {
    const candidates = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload?.models) ? payload.models : []);
    const models = new Map();
    for (const item of candidates) {
        const id = typeof item === 'string' ? item : (item?.id || item?.model || item?.slug);
        if (!id || typeof id !== 'string') {
            continue;
        }
        models.set(id, resolveModelMetadata(safeProviderModel(item, id)));
    }
    return [...models.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export async function fetchProviderModels(configuration, options = {}) {
    const request = options.request || fetch;
    const timeoutMs = Number(options.timeoutMs || 10_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {Accept: 'application/json'};
    if (configuration.credential) {
        headers.Authorization = `Bearer ${configuration.credential}`;
    }

    try {
        const response = await request(buildModelsUrl(configuration.baseUrl), {
            headers,
            signal: controller.signal
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Provider /models request failed (${response.status}): ${body.slice(0, 300)}`);
        }
        return normalizeModelList(await response.json());
    } finally {
        clearTimeout(timeout);
    }
}

export function createCatalogEntry(model) {
    const metadata = model?.reasoningOptions ? model : resolveModelMetadata(model);
    return {
        additional_speed_tiers: [],
        availability_nux: null,
        base_instructions: 'You are Codex, a coding agent. You and the user share the same workspace and collaborate to achieve the user\'s goals.',
        context_window: metadata.contextWindow,
        default_reasoning_level: metadata.defaultReasoningEffort,
        default_reasoning_summary: 'none',
        description: metadata.description,
        display_name: metadata.displayName || metadata.id,
        effective_context_window_percent: 95,
        experimental_supported_tools: [],
        input_modalities: [...metadata.inputModalities],
        max_context_window: metadata.maxContextWindow,
        priority: 1000,
        service_tiers: [],
        shell_type: 'shell_command',
        slug: metadata.id,
        support_verbosity: false,
        supported_in_api: true,
        supported_reasoning_levels: metadata.reasoningOptions.map(item => ({...item})),
        supports_image_detail_original: false,
        supports_parallel_tool_calls: metadata.supportsParallelToolCalls,
        supports_reasoning_summaries: metadata.supportsReasoningSummaries,
        supports_search_tool: metadata.supportsSearchTool,
        truncation_policy: {limit: 10000, mode: 'bytes'},
        upgrade: null,
        visibility: 'list'
    };
}

function updateRootConfigValues(configuration, values) {
    let source = fs.readFileSync(configuration.configPath, 'utf8');
    for (const [key, value] of Object.entries(values)) {
        source = setTomlValue(source, '', key, value);
    }
    atomicWrite(configuration.configPath, source);
}

export async function inspectCodexModels(options = {}) {
    const configuration = readCodexConfiguration(options);
    const models = await fetchProviderModels(configuration, options);
    const catalog = configuration.modelCatalogPath ? readJsonIfExists(configuration.modelCatalogPath) : null;
    const catalogModels = Array.isArray(catalog?.models) ? catalog.models : [];
    return {
        codexHome: configuration.codexHome,
        configPath: configuration.configPath,
        model: configuration.model,
        reasoningEffort: configuration.reasoningEffort,
        modelProvider: configuration.modelProvider,
        baseUrl: configuration.baseUrl,
        wireApi: configuration.wireApi,
        credential: configuration.credentialStatus,
        catalogPath: configuration.modelCatalogPath,
        catalogCount: catalogModels.length,
        models,
        activeModelMetadata: models.find(item => item.id === configuration.model) || null,
        activeReasoningSupported: Boolean(models.find(item => item.id === configuration.model)?.reasoningEfforts.includes(configuration.reasoningEffort)),
        builtInProfiles: listBuiltInProfiles(),
        activeModelAvailable: models.some(item => item.id === configuration.model),
        activeModelInCatalog: catalogModels.some(item => item?.slug === configuration.model || item?.model === configuration.model)
    };
}

export async function syncModelCatalog(options = {}) {
    const configuration = readCodexConfiguration(options);
    const models = await fetchProviderModels(configuration, options);
    if (models.length === 0) {
        throw new Error('The provider returned no usable models. The catalog was not changed.');
    }

    const outputPath = path.resolve(options.outputPath || configuration.modelCatalogPath || path.join(configuration.codexHome, DEFAULT_CATALOG_NAME));
    atomicWrite(outputPath, `${JSON.stringify({models: models.map(createCatalogEntry)}, null, 2)}\n`);
    updateRootConfigValues(configuration, {model_catalog_json: outputPath});

    return {
        catalogPath: outputPath,
        modelCount: models.length,
        activeModelAvailable: models.some(item => item.id === configuration.model)
    };
}

export async function setCodexModel(model, options = {}) {
    if (!model || typeof model !== 'string') {
        throw new Error('A model id is required.');
    }
    const configuration = readCodexConfiguration(options);
    const models = await fetchProviderModels(configuration, options);
    const selected = models.find(item => item.id === model);
    if (!selected) {
        throw new Error(`The provider does not expose model "${model}". The Codex configuration was not changed.`);
    }
    const requestedEffort = typeof options.reasoningEffort === 'string' ? options.reasoningEffort : configuration.reasoningEffort;
    const reasoningEffort = selected.reasoningEfforts.includes(requestedEffort)
        ? requestedEffort
        : selected.defaultReasoningEffort;
    updateRootConfigValues(configuration, {model, model_reasoning_effort: reasoningEffort});
    return {model, reasoningEffort, configPath: configuration.configPath};
}

export async function setCodexReasoningEffort(effort, options = {}) {
    if (!effort || typeof effort !== 'string') {
        throw new Error('A reasoning effort is required.');
    }
    const configuration = readCodexConfiguration(options);
    const models = await fetchProviderModels(configuration, options);
    const activeModel = models.find(item => item.id === configuration.model);
    if (!activeModel) {
        throw new Error(`The active model "${configuration.model}" is not exposed by the provider. The Codex configuration was not changed.`);
    }
    if (!activeModel.reasoningEfforts.includes(effort)) {
        throw new Error(`Model "${activeModel.id}" does not support reasoning effort "${effort}". Supported values: ${activeModel.reasoningEfforts.join(', ')}.`);
    }
    updateRootConfigValues(configuration, {model_reasoning_effort: effort});
    return {model: activeModel.id, reasoningEffort: effort, configPath: configuration.configPath};
}

function makeRepairScript() {
    return String.raw`#!/usr/bin/env node
/*
 * One-time Codex Desktop Statsig model-filter repair.
 * Generated by @holic512/plugin-codex-models. Do not run while Codex is open.
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const CONFIG_ID = ${JSON.stringify(STATSIG_CONFIG_ID)};
const args = process.argv.slice(2);
const readOption = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || '' : '';
};
const model = readOption('--model');
const dryRun = args.includes('--dry-run');
const clearEvaluations = args.includes('--clear-evaluations');
const freeze = args.includes('--freeze-statsig-cache');
if ((!model && !clearEvaluations) || (model && clearEvaluations)) {
  throw new Error('Use --model <id> or --clear-evaluations, but not both.');
}
const leveldbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Codex', 'Default', 'Local Storage', 'leveldb');
const lockPath = path.join(leveldbPath, 'LOCK');
const prefix = 'statsig.cached.evaluations.';

function ensureLockIsFree() {
  if (!fs.existsSync(leveldbPath)) throw new Error('Codex Desktop LevelDB was not found: ' + leveldbPath);
  if (!fs.existsSync(lockPath)) throw new Error('LevelDB LOCK file was not found: ' + lockPath);
  let holders = '';
  try {
    holders = execFileSync('lsof', ['-nP', lockPath], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch (error) {
    if (error.status === 1) return;
    throw new Error('Could not verify the LevelDB lock with lsof: ' + error.message);
  }
  if (holders) throw new Error('Codex (or a helper process) still holds LevelDB LOCK. Fully quit Codex before continuing.\n' + holders);
}
function findClassicLevelRequire() {
  const roots = [
    '/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/browser/scripts/node_modules/classic-level',
    '/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/scripts/node_modules/classic-level',
    '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/browser/scripts/node_modules/classic-level',
    '/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/scripts/node_modules/classic-level'
  ];
  const root = roots.find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
  if (!root) throw new Error('Codex bundled classic-level was not found. This script does not install third-party dependencies.');
  return createRequire(path.join(root, 'package.json'));
}
function decodeChromiumValue(value) {
  const buffer = Buffer.from(value);
  if (buffer.length < 1) throw new Error('Encountered an empty Chromium Local Storage value.');
  if (buffer[0] === 0) return {tag: 0, text: buffer.subarray(1).toString('utf16le')};
  if (buffer[0] === 1) return {tag: 1, text: buffer.subarray(1).toString('utf8')};
  throw new Error('Unsupported Chromium Local Storage value tag: ' + buffer[0]);
}
function encodeChromiumValue(tag, text) {
  const encoded = Buffer.from(text, tag === 0 ? 'utf16le' : 'utf8');
  return Buffer.concat([Buffer.from([tag]), encoded]);
}
function keyText(key) {
  const buffer = Buffer.from(key);
  const utf8 = buffer.toString('utf8');
  if (utf8.includes(prefix)) return utf8;
  if (buffer.length > 1 && (buffer[0] === 0 || buffer[0] === 1)) {
    try { return decodeChromiumValue(buffer).text; } catch { return utf8; }
  }
  return utf8;
}
function parseStatsigRecord(value) {
  const decoded = decodeChromiumValue(value);
  const outer = JSON.parse(decoded.text);
  const dataWasString = typeof outer.data === 'string';
  const data = dataWasString ? JSON.parse(outer.data) : outer.data;
  if (!data || typeof data !== 'object') throw new Error('Statsig evaluation payload has no object data field.');
  return {tag: decoded.tag, outer, data, dataWasString};
}
function inspectEvaluation(parsed) {
  const value = parsed.data.dynamic_configs?.[CONFIG_ID]?.value;
  return {
    configFound: Boolean(value && typeof value === 'object'),
    containsModel: Boolean(Array.isArray(value?.available_models) && value.available_models.includes(model)),
    useHiddenModels: value?.use_hidden_models
  };
}
function freezeEvaluationTime(parsed) {
  if (!freeze) return [];
  const now = Date.now();
  const paths = [];
  if (Object.hasOwn(parsed.data, 'time')) {
    parsed.data.time = now;
    paths.push('data.time');
  }
  if (parsed.data.evaluations && typeof parsed.data.evaluations === 'object') {
    parsed.data.evaluations.time = now;
    paths.push('data.evaluations.time');
  }
  if (parsed.outer.evaluations && typeof parsed.outer.evaluations === 'object') {
    parsed.outer.evaluations.time = now;
    paths.push('outer.evaluations.time');
  }
  if (paths.length === 0) {
    parsed.data.time = now;
    paths.push('data.time (created)');
  }
  return paths;
}
function updateEvaluation(parsed) {
  const dynamic = parsed.data.dynamic_configs;
  const config = dynamic && dynamic[CONFIG_ID];
  if (!config || typeof config !== 'object' || !config.value || typeof config.value !== 'object') return null;
  const value = config.value;
  const available = Array.isArray(value.available_models) ? value.available_models.filter(item => typeof item === 'string') : [];
  if (!available.includes(model)) available.push(model);
  value.available_models = available;
  value.use_hidden_models = false;
  return {freezePaths: freezeEvaluationTime(parsed)};
}
function copyBackup() {
  const parent = path.dirname(leveldbPath);
  const backup = path.join(parent, 'leveldb-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid);
  fs.cpSync(leveldbPath, backup, {recursive: true, preserveTimestamps: true, errorOnExist: true});
  return backup;
}
const {ClassicLevel} = findClassicLevelRequire()('classic-level');
async function readRecords() {
  const db = new ClassicLevel(leveldbPath, {keyEncoding: 'buffer', valueEncoding: 'buffer'});
  await db.open();
  const records = [];
  try {
    for await (const [key, value] of db.iterator()) {
      const text = keyText(key);
      if (text.includes(prefix)) records.push({key: Buffer.from(key), value: Buffer.from(value), keyText: text});
    }
  } finally { await db.close(); }
  return records;
}
function printDryRun(records) {
  if (clearEvaluations) {
    console.log('Dry run: ' + records.length + ' Statsig evaluation record(s) would be deleted.');
    console.log('No backup and no LevelDB write were made.');
    return;
  }
  let matching = 0;
  records.forEach((record, index) => {
    try {
      const state = inspectEvaluation(parseStatsigRecord(record.value));
      if (state.configFound) matching += 1;
      console.log('Record ' + (index + 1) + ': dynamic config ' + CONFIG_ID + ' found=' + state.configFound + ', available_models contains ' + model + '=' + state.containsModel + ', use_hidden_models=' + String(state.useHiddenModels));
    } catch (error) {
      console.log('Record ' + (index + 1) + ': decode/parse failed: ' + error.message);
    }
  });
  console.log('Dry run complete: ' + matching + ' matching dynamic config(s); no backup and no LevelDB write were made.');
}
async function mutate(records) {
  const db = new ClassicLevel(leveldbPath, {keyEncoding: 'buffer', valueEncoding: 'buffer'});
  await db.open();
  try {
    const operations = [];
    const freezePaths = new Set();
    let matched = 0;
    for (const record of records) {
      if (clearEvaluations) {
        operations.push({type: 'del', key: record.key});
        matched += 1;
        continue;
      }
      const parsed = parseStatsigRecord(record.value);
      const changed = updateEvaluation(parsed);
      if (!changed) continue;
      changed.freezePaths.forEach(item => freezePaths.add(item));
      parsed.outer.data = parsed.dataWasString ? JSON.stringify(parsed.data) : parsed.data;
      operations.push({type: 'put', key: record.key, value: encodeChromiumValue(parsed.tag, JSON.stringify(parsed.outer))});
      matched += 1;
    }
    if (!matched) throw new Error('No Statsig evaluation containing dynamic config ' + CONFIG_ID + ' was found. No write was made.');
    await db.batch(operations);
    return {matched, freezePaths: [...freezePaths]};
  } finally { await db.close(); }
}
async function verify() {
  const records = await readRecords();
  if (clearEvaluations) {
    if (records.length) throw new Error('Verification failed: Statsig evaluation records remain.');
    return 0;
  }
  let verified = 0;
  for (const record of records) {
    const state = inspectEvaluation(parseStatsigRecord(record.value));
    if (state.configFound && state.useHiddenModels === false && state.containsModel) verified += 1;
  }
  if (!verified) throw new Error('Verification failed: no repaired Statsig configuration was found.');
  return verified;
}
ensureLockIsFree();
const records = await readRecords();
if (!records.length) throw new Error('No statsig.cached.evaluations.* record was found. No write was made.');
console.log('Found ' + records.length + ' Statsig evaluation record(s).');
if (dryRun) {
  printDryRun(records);
} else {
  const backup = copyBackup();
  console.log('Complete LevelDB backup: ' + backup);
  const changed = await mutate(records);
  const verified = await verify();
  console.log((clearEvaluations ? 'Cleared' : 'Repaired') + ' ' + changed.matched + ' record(s); verified ' + verified + '.');
  if (freeze && !clearEvaluations) {
    console.log('Statsig evaluation time refreshed at: ' + changed.freezePaths.join(', ') + '.');
    console.log('This can temporarily freeze other Statsig updates for this cache identity. Restore the full backup or run --clear-evaluations to roll back.');
  }
  console.log('Start Codex Desktop and verify the model button shows the formal display name, not “Custom”.');
}
`;
}

export function createDesktopRepairScript(model, options = {}) {
    if (!model || typeof model !== 'string') {
        throw new Error('A target model id is required to create a desktop repair script.');
    }
    const outputDir = path.resolve(options.outputDir || path.join(os.homedir(), DEFAULT_REPAIR_DIR));
    const outputPath = path.join(outputDir, 'repair-codex-desktop-model-filter.mjs');
    atomicWrite(outputPath, makeRepairScript(), 0o700);
    fs.chmodSync(outputPath, 0o700);
    const bundledNodeCandidates = [
        '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node',
        '/Applications/Codex.app/Contents/Resources/cua_node/bin/node'
    ];
    const nodeExecutable = bundledNodeCandidates.find(candidate => fs.existsSync(candidate)) || process.execPath;
    const commandPrefix = `${JSON.stringify(nodeExecutable)} ${JSON.stringify(outputPath)}`;
    return {
        outputPath,
        nodeExecutable,
        command: `${commandPrefix} --model ${JSON.stringify(model)} --dry-run`,
        repairCommand: `${commandPrefix} --model ${JSON.stringify(model)} --freeze-statsig-cache`,
        rollbackCommand: `${commandPrefix} --clear-evaluations`
    };
}
