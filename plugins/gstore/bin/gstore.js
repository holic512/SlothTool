#!/usr/bin/env node

/**
 * @file GStorePluginEntry
 * @project SlothTool
 * @module GStore Plugin / Entry
 * @description gstore 插件命令入口，无参数默认进入 TUI，显式子命令提供 GitHub 数据同步 CLI。
 * @logic 1. 解析 auth、repo、bind、status、pull、push、sync 等命令；2. 将同步业务委托给 service；3. 在终端环境下启动 Ink TUI。
 * @dependencies Services: ../lib/service.js, TUI: ../lib/tui.js, I18N: ../lib/i18n.js
 * @index_tags gstore入口, GitHub同步, 默认TUI, CLI子命令
 * @author holic512
 */

import {t} from '../lib/i18n.js';
import {
    GStoreConflictError,
    GStoreRemoteChangedError,
    bindDataDirectory,
    classifyError,
    configureRepository,
    ensureAuth,
    getBindingStatus,
    getConflicts,
    getRepositorySummary,
    listBindings,
    pullBinding,
    pushBinding,
    runDoctor,
    syncBinding,
    unbindDataDirectory
} from '../lib/service.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  gstore');
    console.log('  gstore --tui');
    console.log('  gstore auth');
    console.log('  gstore repo set <OWNER/REPO|remote-url|path> [--create]');
    console.log('  gstore repo status [--json]');
    console.log('  gstore bind <tool> <name> <localDir>');
    console.log('  gstore list [--json]');
    console.log('  gstore unbind <tool> <name>');
    console.log('  gstore status <tool> <name> [--json]');
    console.log('  gstore pull <tool> <name>');
    console.log('  gstore push <tool> <name> [-m message]');
    console.log('  gstore sync <tool> <name> [-m message]');
    console.log('  gstore conflicts <tool> <name> [--json]');
    console.log('  gstore doctor [--json]');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help        ${t('help')}`);
    console.log(`  --tui             ${t('tuiOption')}`);
    console.log(`  --json            ${t('jsonOption')}`);
    console.log(`  --create          ${t('createOption')}`);
    console.log(`  -m, --message     ${t('messageOption')}`);
    console.log('');
    console.log(t('examples'));
    console.log('  gstore repo set holic512/my-private-data --create');
    console.log('  gstore bind todo default ~/.slothtool/data/todo/default');
    console.log('  gstore sync todo default');
}

function hasFlag(args, flag) {
    return args.includes(flag);
}

function readOption(args, shortName, longName) {
    const shortIndex = args.indexOf(shortName);
    if (shortIndex >= 0) {
        return args[shortIndex + 1] || '';
    }

    const longIndex = args.indexOf(longName);
    if (longIndex >= 0) {
        return args[longIndex + 1] || '';
    }

    return '';
}

function removeOptions(args) {
    const nextArgs = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--json' || arg === '--create' || arg === '--tui' || arg === '-i' || arg === '--interactive') {
            continue;
        }

        if (arg === '-m' || arg === '--message') {
            index += 1;
            continue;
        }

        nextArgs.push(arg);
    }

    return nextArgs;
}

function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}

function printBindings(bindings, json) {
    if (json) {
        printJson(bindings);
        return;
    }

    if (bindings.length === 0) {
        console.log(t('noBindings'));
        return;
    }

    for (const binding of bindings) {
        console.log(`${binding.tool}/${binding.name}`);
        console.log(`  ${binding.localPath}`);
        console.log(`  ${binding.repoPath}`);
    }
}

function printStatus(status, json) {
    if (json) {
        printJson({
            binding: status.binding,
            localChanges: status.localChanges,
            remoteChanges: status.remoteChanges,
            conflicts: status.conflicts,
            clean: status.clean
        });
        return;
    }

    console.log(t('statusTitle', {tool: status.binding.tool, name: status.binding.name}));
    if (status.clean) {
        console.log(t('clean'));
        return;
    }

    console.log(t('localChanges', {count: status.localChanges.length}));
    console.log(t('remoteChanges', {count: status.remoteChanges.length}));
    console.log(t('conflicts', {count: status.conflicts.length}));

    for (const conflict of status.conflicts) {
        console.log(`  ! ${conflict}`);
    }
}

function printDoctor(result, json) {
    if (json) {
        printJson(result);
        return;
    }

    console.log(t('doctorTitle'));
    console.log(`  git: ${result.git ? t('ok') : t('missing')}`);
    console.log(`  gh: ${result.gh ? t('installed') : t('missing')}`);
    console.log(`  auth: ${result.authenticated ? t('ok') : t('notLoggedIn')}`);
    console.log(`  ${t('dataDir', {dir: result.dataDir})}`);
    console.log(`  ${t('remote', {remote: result.remote || t('noRemote')})}`);
    console.log(`  bindings: ${result.bindings.length}`);
    if (result.ghInstaller) {
        console.log(`  gh installer: ${result.ghInstaller.label}`);
    }
}

function printRepositorySummary(summary, json) {
    if (json) {
        printJson(summary);
        return;
    }

    console.log(t('dataDir', {dir: summary.dataDir}));
    console.log(t('remote', {remote: summary.remote || t('noRemote')}));
    console.log(`bindings: ${summary.bindings.length}`);
}

function printErrorHint(error) {
    if (error instanceof GStoreConflictError) {
        console.error(t('conflictStop'));
        for (const conflict of error.conflicts) {
            console.error(`  ! ${conflict}`);
        }
        return;
    }

    if (error instanceof GStoreRemoteChangedError) {
        console.error(t('remoteChangedStop'));
        for (const remoteChange of error.remoteChanges) {
            console.error(`  * ${remoteChange}`);
        }
        return;
    }

    const kind = classifyError(error);
    if (kind === 'network') {
        console.error(t('networkHint'));
        return;
    }
    if (kind === 'auth') {
        console.error(t('authHint'));
        return;
    }
    if (kind === 'push-rejected') {
        console.error(t('rejectedHint'));
        return;
    }
    if (kind === 'merge-conflict') {
        console.error(t('mergeHint'));
    }
}

async function runCli(args) {
    const json = hasFlag(args, '--json');
    const commandArgs = removeOptions(args);
    const command = commandArgs[0];

    if (command === 'auth') {
        const result = await ensureAuth();
        if (json) {
            printJson(result);
        } else {
            console.log(t('authReady'));
        }
        return;
    }

    if (command === 'repo') {
        const subCommand = commandArgs[1];
        if (subCommand === 'set') {
            const repository = commandArgs[2];
            if (!repository) {
                throw new Error(t('repoRequired'));
            }
            const result = configureRepository(repository, {create: hasFlag(args, '--create')});
            if (json) {
                printJson(result);
            } else {
                console.log(t('repoSet', {repo: result.repository}));
            }
            return;
        }

        if (subCommand === 'status' || !subCommand) {
            printRepositorySummary(getRepositorySummary(), json);
            return;
        }
    }

    if (command === 'bind') {
        const [, tool, name, localDir] = commandArgs;
        if (!tool || !name) {
            throw new Error(t('bindingRequired'));
        }
        if (!localDir) {
            throw new Error(t('localDirRequired'));
        }
        const binding = bindDataDirectory(tool, name, localDir);
        if (json) {
            printJson(binding);
        } else {
            console.log(t('bindDone', binding));
        }
        return;
    }

    if (command === 'list') {
        printBindings(listBindings(), json);
        return;
    }

    if (command === 'unbind') {
        const [, tool, name] = commandArgs;
        if (!tool || !name) {
            throw new Error(t('bindingRequired'));
        }
        const result = unbindDataDirectory(tool, name);
        if (json) {
            printJson(result);
        } else {
            console.log(t('unbindDone', result));
        }
        return;
    }

    if (['status', 'pull', 'push', 'sync', 'conflicts'].includes(command)) {
        const [, tool, name] = commandArgs;
        if (!tool || !name) {
            throw new Error(t('bindingRequired'));
        }

        if (command === 'status') {
            printStatus(getBindingStatus(tool, name), json);
            return;
        }

        if (command === 'pull') {
            const result = pullBinding(tool, name);
            if (json) {
                printJson(result);
            } else {
                console.log(t('pullDone', {count: result.applied.length}));
            }
            return;
        }

        if (command === 'push') {
            const result = pushBinding(tool, name, {message: readOption(args, '-m', '--message')});
            if (json) {
                printJson(result);
            } else if (result.status === 'no-changes') {
                console.log(t('pushNoChanges'));
            } else {
                console.log(t('pushDone', {commit: result.commit}));
            }
            return;
        }

        if (command === 'sync') {
            const result = syncBinding(tool, name, {message: readOption(args, '-m', '--message')});
            if (json) {
                printJson(result);
            } else {
                console.log(t('syncDone'));
            }
            return;
        }

        if (command === 'conflicts') {
            const conflicts = getConflicts(tool, name);
            if (json) {
                printJson(conflicts);
            } else {
                console.log(t('conflicts', {count: conflicts.length}));
                for (const conflict of conflicts) {
                    console.log(`  ! ${conflict}`);
                }
            }
            return;
        }
    }

    if (command === 'doctor') {
        printDoctor(runDoctor(), json);
        return;
    }

    throw new Error(t('unknownCommand', {command}));
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    if (args.length === 0 || args.includes('--tui') || args.includes('-i') || args.includes('--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_GSTORE_TUI_TEST_ACTION) {
            printHelp();
            return;
        }

        const {startGStoreTui} = await import('../lib/tui.js');
        await startGStoreTui();
        return;
    }

    await runCli(args);
}

main().catch(error => {
    console.error(error.message);
    printErrorHint(error);
    process.exit(1);
});
