#!/usr/bin/env node

/**
 * @file SlothVaultMcpPluginEntry
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / MCP Entry
 * @description Standalone MCP CLI entry for profiles, runtime discovery, guarded calls, resources, and redacted history.
 * @logic 1. 解析稳定 MCP CLI 命令与安全输入；2. 复用服务层执行动态发现和调用；3. 对远端写操作强制确认；4. 将错误映射为稳定输出与退出码。
 * @dependencies Node: fs/readline/process, Config/History/Service/TUI
 * @index_tags slothvault,mcp,cli,profile,history,confirmation
 * @author holic512
 */

import fs from 'node:fs';
import {createInterface} from 'node:readline/promises';
import process from 'node:process';
import {
    addProfile,
    getProfile,
    listProfiles,
    maskApiKey,
    removeProfile,
    updateProfile,
    useProfile
} from '../lib/config.js';
import {clearHistory, getHistory, listHistory} from '../lib/history.js';
import {
    callTool,
    classifyError,
    doctor,
    getPrompt,
    getTool,
    listPrompts,
    listResourceTemplates,
    listTools,
    readResource
} from '../lib/service.js';
import {formatSlothVaultError, t} from '../lib/i18n.js';
import {startSlothVaultTui} from '../lib/tui.js';

/** Return whether both standard streams can support interactive confirmation. */
function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Return whether a flag is present in an argument vector. */
function hasFlag(args, flag) {
    return args.includes(flag);
}

/** Read a required option value and reject a missing or flag-like value. */
function readOption(args, option, {required = false} = {}) {
    const index = args.indexOf(option);
    if (index < 0) {
        if (required) {
            throw usageError(t('optionRequired', {option}));
        }
        return '';
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
        throw usageError(t('optionValueRequired', {option}));
    }
    return value;
}

/** Create a usage/configuration error with the stable CLI exit code. */
function usageError(message) {
    const error = new Error(message);
    error.code = 'USAGE_ERROR';
    error.category = 'usage';
    error.exitCode = 2;
    return error;
}

/** Print one JSON document without adding surrounding human-readable output. */
function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}

/** Emit a warning for an insecure HTTP endpoint without interrupting the command. */
function warnProfile(profile) {
    if (profile?.warnings?.length) {
        for (const warning of profile.warnings) {
            console.error(`${t('warning')}: ${localizeProfileWarning(warning)}`);
        }
    } else if (profile?.endpoint?.startsWith('http://')) {
        console.error(`${t('warning')}: ${t('httpWarning')}`);
    }
}

/** Translate stable profile warning text at the CLI presentation boundary. */
function localizeProfileWarning(warning) {
    if (/without transport encryption/iu.test(warning)) {
        return t('httpWarning');
    }
    if (/stored as plaintext/iu.test(warning)) {
        return t('plaintextConfigWarning');
    }
    return warning;
}

/** Mask secrets before a profile object reaches terminal or JSON output. */
function safeProfile(profile) {
    if (!profile) {
        return profile;
    }
    return {
        ...profile,
        apiKey: maskApiKey(profile.apiKey),
        warnings: profile.warnings?.map(localizeProfileWarning)
    };
}

/** Read a hidden line from an interactive terminal without echoing the MCP key. */
async function readHiddenLine(prompt) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw usageError(t('keyStdinEmpty'));
    }
    process.stdout.write(prompt);
    const wasRaw = Boolean(process.stdin.isRaw);
    let value = '';
    let onData;
    try {
        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        return await new Promise((resolve, reject) => {
            onData = chunk => {
                for (const character of String(chunk)) {
                    if (character === '\u0003') {
                        reject(usageError(t('cancelled')));
                        return;
                    }
                    if (character === '\r' || character === '\n') {
                        process.stdout.write('\n');
                        resolve(value.trim());
                        return;
                    }
                    if (character === '\u007f' || character === '\b') {
                        value = value.slice(0, -1);
                    } else {
                        value += character;
                    }
                }
            };
            process.stdin.on('data', onData);
        });
    } finally {
        if (onData) {
            process.stdin.off('data', onData);
        }
        process.stdin.setRawMode?.(wasRaw);
        process.stdin.pause();
    }
}

/** Read all stdin text for key or JSON argument sources. */
async function readStdinText() {
    let value = '';
    for await (const chunk of process.stdin) {
        value += String(chunk);
    }
    return value.trim();
}

/** Resolve a profile key from hidden input, stdin, or a named environment variable. */
async function resolveApiKey(args) {
    const stdin = hasFlag(args, '--key-stdin');
    const envName = readOption(args, '--key-env');
    if (stdin && envName) {
        throw usageError(t('keySourceExclusive'));
    }
    if (stdin) {
        const value = await readStdinText();
        if (!value) {
            throw usageError(t('keyStdinEmpty'));
        }
        return value;
    }
    if (envName) {
        const value = process.env[envName]?.trim();
        if (!value) {
            throw usageError(t('keyEnvEmpty', {name: envName}));
        }
        return value;
    }
    return await readHiddenLine(t('keyPrompt'));
}

/** Parse a JSON object supplied directly, by file, or through stdin. */
async function readJsonArguments(args) {
    const directIndex = args.indexOf('--args');
    const fileIndex = args.indexOf('--args-file');
    const directCount = args.filter(argument => argument === '--args').length;
    const fileCount = args.filter(argument => argument === '--args-file').length;
    const sourceCount = directCount + fileCount;
    if (sourceCount > 1) {
        throw usageError(t('argsSourceExclusive'));
    }
    if (sourceCount === 0) {
        return {value: {}, source: 'none'};
    }

    let raw = '';
    let source = 'direct';
    if (directIndex >= 0) {
        raw = args[directIndex + 1] || '';
        if (!raw || raw.startsWith('--')) {
            throw usageError(t('argsValueRequired'));
        }
    } else {
        const filePath = fileIndex >= 0 ? args[fileIndex + 1] : '-';
        if (fileIndex >= 0 && (!filePath || filePath.startsWith('--'))) {
            throw usageError(t('argsFileValueRequired'));
        }
        source = 'stdin';
        if (filePath === '-') {
            raw = await readStdinText();
        } else {
            source = 'file';
            try {
                raw = fs.readFileSync(filePath, 'utf8');
            } catch (error) {
                throw usageError(t('argsFileRead', {path: filePath}) + ` (${error.message})`);
            }
        }
    }

    if (!raw.trim()) {
        return {value: {}, source};
    }
    let value;
    try {
        value = JSON.parse(raw);
    } catch (error) {
        throw usageError(t('argsJsonInvalid', {message: error.message}));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw usageError(t('argsObject'));
    }
    return {value, source};
}

/** Render a profile list for human-readable output. */
function printProfiles(profiles, json) {
    const safeProfiles = profiles.map(safeProfile);
    if (json) {
        printJson(safeProfiles);
        return;
    }
    console.log(t('profileListTitle'));
    if (!safeProfiles.length) {
        console.log(t('noProfile'));
        return;
    }
    for (const profile of safeProfiles) {
        console.log(`${profile.name}${profile.isDefault ? ` (${t('profileDefault')})` : ''}`);
        console.log(`  ${t('profileEndpoint')}: ${profile.endpoint}`);
        console.log(`  ${t('profileTimeout')}: ${profile.timeoutMs} ms`);
        console.log(`  ${t('tui.labels.key')}: ${profile.apiKey}`);
        warnProfile(profile);
    }
}

/** Render a list of discovered capability definitions. */
function printCapabilities(items, json, kind) {
    if (json) {
        printJson(items);
        return;
    }
    if (!items.length) {
        console.log(t(`no${kind[0].toUpperCase()}${kind.slice(1)}`));
        return;
    }
    for (const item of items) {
        const detail = item.description || item.uriTemplate || item.uri || '';
        const risk = item.annotations?.readOnlyHint === true ? t('readOnly') : kind === 'tools' ? t('write') : '';
        console.log(`${item.name || item.uriTemplate || item.uri}${risk ? ` [${risk}]` : ''}${detail ? `\n  ${detail}` : ''}`);
    }
}

/** Render a successful doctor result. */
function printDoctor(result, json) {
    const safeResult = result.profile ? {...result, profile: safeProfile(result.profile)} : result;
    if (safeResult.profile) {
        warnProfile(safeResult.profile);
    }
    if (json) {
        printJson(safeResult);
        return;
    }
    console.log(t('doctorTitle'));
    console.log(`${t('server')}: ${safeResult.server?.name || '-'}`);
    console.log(`${t('version')}: ${safeResult.server?.version || '-'}`);
    console.log(`${t('endpoint')}: ${safeResult.profile?.endpoint || '-'}`);
    console.log(`${t('tools')}: ${safeResult.capabilities?.tools ?? 0}`);
    console.log(`${t('prompts')}: ${safeResult.capabilities?.prompts ?? 0}`);
    console.log(`${t('resources')}: ${safeResult.capabilities?.resourceTemplates ?? 0}`);
}

/** Ask for a write-capable Tool confirmation in an interactive terminal. */
async function confirmTool({tool, argumentsSummary, signal}) {
    if (!isInteractiveTerminal()) {
        return false;
    }
    const rl = createInterface({input: process.stdin, output: process.stdout});
    try {
        const answer = await rl.question(
            t('confirmTool', {name: tool.name, summary: argumentsSummary || '{}'}),
            {signal}
        );
        return ['y', 'yes'].includes(answer.trim().toLowerCase());
    } finally {
        rl.close();
    }
}

/** Print help for the complete stable CLI surface. */
function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  slothvault-mcp');
    console.log('  slothvault-mcp --tui');
    console.log('  slothvault-mcp profile add <name> --url <url> [--timeout <ms>] [--default] [--key-stdin|--key-env <env>]');
    console.log('  slothvault-mcp profile update <name> [--url <url>] [--timeout <ms>] [--key-stdin|--key-env <env>]');
    console.log('  slothvault-mcp profile list|show <name>|use <name>|remove <name>');
    console.log('  slothvault-mcp doctor [--profile <name>] [--json]');
    console.log('  slothvault-mcp tools list [--profile <name>] [--json]');
    console.log('  slothvault-mcp tools show <tool> [--profile <name>] [--json]');
    console.log('  slothvault-mcp tools call <tool> [--args <json>|--args-file <path|->] [--profile <name>] [--yes] [--json]');
    console.log('  slothvault-mcp prompts list [--profile <name>] [--json]');
    console.log('  slothvault-mcp prompts get <prompt> [--args <json>|--args-file <path|->] [--profile <name>] [--json]');
    console.log('  slothvault-mcp resources list [--profile <name>] [--json]');
    console.log('  slothvault-mcp resources read <uri> --output <path> [--profile <name>] [--json]');
    console.log('  slothvault-mcp history list|show <id>|clear [--json] [--yes]');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help          ${t('help')}`);
    console.log(`  --tui, -i           ${t('tuiOption')}`);
    console.log(`  --profile <name>    ${t('profileOption')}`);
    console.log(`  --json              ${t('jsonOption')}`);
    console.log(`  --yes               ${t('yesOption')}`);
    console.log(`  --args <json>       ${t('argsOption')}`);
    console.log(`  --args-file <path>  ${t('argsFileOption')}`);
    console.log(`  --output <path>     ${t('outputOption')}`);
    console.log('');
    console.log(t('examples'));
    console.log('  slothvault-mcp profile add production --url https://vault.example/mcp');
    console.log('  slothvault-mcp tools list --profile production');
    console.log('  slothvault-mcp tools call content.note.content.list_versions --args "{}"');
}

/** Run profile management commands. */
async function runProfileCommand(args, json) {
    const subcommand = args[1] || 'list';
    const name = args[2];
    if (['add', 'update', 'use', 'remove', 'show'].includes(subcommand) && !name) {
        throw usageError(t('profileRequired'));
    }
    if (subcommand === 'list') {
        printProfiles(listProfiles(), json);
        return;
    }
    if (subcommand === 'show') {
        const profile = getProfile(name);
        if (json) {
            printJson(profile);
        } else {
            printProfiles([profile], false);
        }
        return;
    }
    if (subcommand === 'use') {
        const profile = useProfile(name);
        if (json) printJson(profile);
        else console.log(t('profileUsed', {name}));
        return;
    }
    if (subcommand === 'remove') {
        const result = removeProfile(name);
        if (json) printJson(result);
        else console.log(t('profileRemoved', {name}));
        return;
    }
    if (subcommand === 'add' || subcommand === 'update') {
        const endpoint = readOption(args, '--url');
        const timeout = readOption(args, '--timeout');
        const keyRequested = hasFlag(args, '--key-stdin') || hasFlag(args, '--key-env');
        const patch = {};
        if (endpoint) patch.endpoint = endpoint;
        if (timeout) patch.timeoutMs = Number(timeout);
        if (hasFlag(args, '--default')) patch.makeDefault = true;
        if (subcommand === 'add' && json && !keyRequested) {
            throw usageError(t('jsonKeySourceRequired'));
        }
        if (keyRequested || subcommand === 'add') patch.apiKey = await resolveApiKey(args);
        const profile = subcommand === 'add' ? addProfile(name, patch) : updateProfile(name, patch);
        if (json) printJson(safeProfile(profile));
        else console.log(t(subcommand === 'add' ? 'profileAdded' : 'profileUpdated', {name}));
        warnProfile(profile);
        return;
    }
    throw usageError(t('unknownCommand', {command: `profile ${subcommand}`}));
}

/** Run capability discovery and operation commands. */
async function runRemoteCommand(args, json, profileName) {
    const command = args[0];
    const subcommand = args[1];
    const options = {profile: profileName || undefined};
    if (command === 'doctor') {
        printDoctor(await doctor(options), json);
        return;
    }
    if (command === 'tools' && subcommand === 'list') {
        const result = await listTools(options);
        printCapabilities(result.tools || result, json, 'tools');
        return;
    }
    if (command === 'tools' && subcommand === 'show') {
        const name = args[2];
        if (!name) throw usageError(t('toolRequired'));
        const result = await getTool(name, options);
        if (json) printJson(result);
        else printCapabilities([result.tool], false, 'tools');
        return;
    }
    if (command === 'tools' && subcommand === 'call') {
        const name = args[2];
        if (!name) throw usageError(t('toolRequired'));
        const parsed = await readJsonArguments(args);
        const forceYes = hasFlag(args, '--yes');
        const confirmationAllowed = forceYes || (isInteractiveTerminal() && !json && parsed.source !== 'stdin');
        const result = await callTool(name, parsed.value, {
            ...options,
            confirm: confirmationAllowed ? (forceYes ? async () => true : confirmTool) : async () => false
        });
        if (json) printJson(result);
        else console.log(t('callSucceeded', {name}), `\n${JSON.stringify(result.result, null, 2)}`);
        return;
    }
    if (command === 'prompts' && subcommand === 'list') {
        const result = await listPrompts(options);
        printCapabilities(result.prompts || result, json, 'prompts');
        return;
    }
    if (command === 'prompts' && subcommand === 'get') {
        const name = args[2];
        if (!name) throw usageError(t('promptRequired'));
        const parsed = await readJsonArguments(args);
        const result = await getPrompt(name, parsed.value, options);
        if (json) printJson(result);
        else console.log(t('promptFetched', {name}), `\n${JSON.stringify(result.result, null, 2)}`);
        return;
    }
    if (command === 'resources' && subcommand === 'list') {
        const result = await listResourceTemplates(options);
        printCapabilities(result.resourceTemplates || result, json, 'resources');
        return;
    }
    if (command === 'resources' && subcommand === 'read') {
        const uri = args[2];
        if (!uri) throw usageError(t('uriRequired'));
        const outputPath = readOption(args, '--output', {required: true});
        const result = await readResource(uri, outputPath, options);
        if (json) printJson({uri: result.uri, path: result.path, mimeType: result.mimeType, fileName: result.fileName, bytes: result.bytes});
        else console.log(t('resourceSaved', {path: result.path, bytes: result.bytes}));
        return;
    }
    throw usageError(t('unknownCommand', {command: args.join(' ')}));
}

/** Run local history commands without contacting SlothVault. */
async function runHistoryCommand(args, json) {
    const subcommand = args[1] || 'list';
    if (subcommand === 'list') {
        const entries = listHistory();
        if (json) printJson(entries);
        else if (!entries.length) console.log(t('historyEmpty'));
        else for (const entry of entries) console.log(`${entry.id} | ${entry.operation} ${entry.name || ''} | ${entry.success ? t('ok') : t('error')} | ${entry.summary || ''}`);
        return;
    }
    if (subcommand === 'show') {
        const id = args[2];
        if (!id) throw usageError(t('historyIdRequired'));
        const entry = getHistory(id);
        if (!entry) throw usageError(t('invalidId', {id}));
        if (json) printJson(entry);
        else console.log(JSON.stringify(entry, null, 2));
        return;
    }
    if (subcommand === 'clear') {
        if (!hasFlag(args, '--yes')) {
            if (!isInteractiveTerminal() || json) {
                throw usageError(t('confirmationRequired'));
            }
            const rl = createInterface({input: process.stdin, output: process.stdout});
            try {
                const answer = await rl.question(t('historyConfirm'));
                if (!['y', 'yes'].includes(answer.trim().toLowerCase())) {
                    throw usageError(t('cancelled'));
                }
            } finally {
                rl.close();
            }
        }
        const result = clearHistory();
        if (json) printJson(result);
        else console.log(t('historyCleared'));
        return;
    }
    throw usageError(t('unknownCommand', {command: `history ${subcommand}`}));
}

/** Dispatch the complete CLI after removing global flags. */
async function runCli(args) {
    const json = hasFlag(args, '--json');
    const profileName = readOption(args, '--profile');
    const commandArgs = args.filter((arg, index) => arg !== '--json' && arg !== '--profile' && (index === 0 || args[index - 1] !== '--profile'));
    const command = commandArgs[0];
    if (command === 'profile') {
        await runProfileCommand(commandArgs, json);
        return;
    }
    if (command === 'history') {
        await runHistoryCommand(commandArgs, json);
        return;
    }
    await runRemoteCommand(commandArgs, json, profileName);
}

/** Launch the default TUI or dispatch a CLI command and map errors to stable codes. */
async function main() {
    const args = process.argv.slice(2);
    if (args.some(argument => argument === '--key' || argument.startsWith('--key='))) {
        throw usageError(t('directKeyUnsupported'));
    }
    if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
        printHelp();
        return;
    }
    if (args.length === 0 || hasFlag(args, '--tui') || hasFlag(args, '-i') || hasFlag(args, '--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION) {
            throw usageError(t('tuiRequiresTerminal'));
        }
        await startSlothVaultTui();
        return;
    }
    await runCli(args);
}

main().catch(error => {
    const classification = classifyError(error);
    const exitCode = Number(error?.exitCode || classification?.exitCode || 1);
    const message = formatSlothVaultError(error);
    if (process.argv.slice(2).includes('--json')) {
        printJson({
            ok: false,
            error: {
                code: error?.code || classification?.code || 'INTERNAL_ERROR',
                category: error?.category || classification?.category || 'internal',
                message
            }
        });
    } else {
        console.error(`${t('error')}: ${message}`);
    }
    process.exitCode = exitCode;
});
