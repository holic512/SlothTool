#!/usr/bin/env node

const {t} = require('../lib/i18n');
const systemd = require('../lib/systemd');
const history = require('../lib/history');
const config = require('../lib/config');
const {interactiveMain} = require('../lib/interactive');

const args = process.argv.slice(2);

function showHelp() {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  systemd [options] [command]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -i, --interactive ' + t('interactive') + '\n');
    console.log(t('commands'));
    console.log('  list [--all] [--state active|inactive|failed] [--pattern <keyword>]  ' + t('commandList'));
    console.log('  start <service>                                                 ' + t('commandStart'));
    console.log('  stop <service>                                                  ' + t('commandStop'));
    console.log('  restart <service>                                               ' + t('commandRestart'));
    console.log('  enable <service>                                                ' + t('commandEnable'));
    console.log('  disable <service>                                               ' + t('commandDisable'));
    console.log('  logs <service> [--lines N] [--follow] [--since "..."]            ' + t('commandLogs'));
    console.log('  status <service>                                                ' + t('commandStatus') + '\n');
    console.log(t('examples'));
    console.log('  systemd -i                          ' + t('exampleInteractive'));
    console.log('  systemd list --state active         ' + t('exampleList'));
    console.log('  systemd list --all                  ' + t('exampleListAll'));
    console.log('  systemd start ssh.service           ' + t('exampleStart'));
    console.log('  systemd logs ssh.service --lines 50 ' + t('exampleLogs'));
}

function printError(message) {
    console.error(message);
}

function checkEnvOrExit() {
    const env = systemd.checkEnvironment();
    if (!env.ok) {
        printError(env.message);
        process.exit(1);
    }
}

function requireServiceName(name) {
    if (!name) {
        printError(t('missingService'));
        process.exit(2);
    }
    if (!systemd.validateServiceName(name)) {
        printError(t('invalidServiceName'));
        process.exit(2);
    }
}

function handlePermissionSuggestion(result, action, service) {
    if (!result || result.success) return;
    if (systemd.detectPermissionError(result.message || result.stderr)) {
        const suggestion = action === 'logs'
            ? `sudo journalctl -u ${service}`
            : action === 'list'
                ? 'sudo systemctl list-units --type=service'
                : `sudo systemctl ${action} ${service}`;
        console.error(t('permissionDenied'));
        console.error(t('suggestion') + ' ' + suggestion);
    }
}

async function main() {
    if (args.length === 0 || args.includes('-i') || args.includes('--interactive')) {
        checkEnvOrExit();
        await interactiveMain();
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    checkEnvOrExit();

    const command = args[0];

    if (command === 'list') {
        const all = args.includes('--all');
        let state;
        let pattern;
        for (let i = 1; i < args.length; i += 1) {
            if (args[i] === '--state' && args[i + 1]) {
                state = args[i + 1];
            }
            if (args[i] === '--pattern' && args[i + 1]) {
                pattern = args[i + 1];
            }
        }
        const result = await systemd.listServices({all, state, pattern});
        if (result.result.success) {
            process.stdout.write(result.result.stdout);
        } else {
            printError(result.result.message || t('commandFailed'));
            handlePermissionSuggestion(result.result, 'list', '');
            process.exit(1);
        }
        return;
    }

    if (command === 'start' || command === 'stop' || command === 'restart' || command === 'enable' || command === 'disable' || command === 'status') {
        const service = args[1];
        requireServiceName(service);
        let result;
        switch (command) {
            case 'start':
                result = await systemd.startService(service);
                break;
            case 'stop':
                result = await systemd.stopService(service);
                break;
            case 'restart':
                result = await systemd.restartService(service);
                break;
            case 'enable':
                result = await systemd.enableService(service);
                break;
            case 'disable':
                result = await systemd.disableService(service);
                break;
            case 'status':
                result = await systemd.statusService(service);
                break;
        }
        if (result.success) {
            if (result.stdout && !result.streamed) process.stdout.write(result.stdout);
        } else {
            printError(result.message || t('commandFailed'));
            handlePermissionSuggestion(result, command, service);
            process.exit(1);
        }
        history.addRecentService(service);
        history.addAction(systemd.buildResult(command, service, result));
        return;
    }

    if (command === 'logs') {
        const service = args[1];
        requireServiceName(service);
        let lines;
        let follow = false;
        let since;
        for (let i = 2; i < args.length; i += 1) {
            if (args[i] === '--lines' && args[i + 1]) {
                lines = Number(args[i + 1]);
            }
            if (args[i] === '--follow') {
                follow = true;
            }
            if (args[i] === '--since' && args[i + 1]) {
                since = args[i + 1];
            }
        }
        const cfg = config.readConfig();
        const result = await systemd.showLogs(service, {
            lines: lines || cfg.logLines,
            follow,
            since
        });
        if (result.success) {
            if (result.stdout && !result.streamed) process.stdout.write(result.stdout);
        } else {
            printError(result.message || t('commandFailed'));
            handlePermissionSuggestion(result, 'logs', service);
            process.exit(1);
        }
        history.addRecentService(service);
        history.addAction(systemd.buildResult('logs', service, result));
        return;
    }

    printError(t('invalidArgs'));
    showHelp();
    process.exit(2);
}

process.on('SIGINT', () => {
    process.exit(0);
});

main().catch(error => {
    console.error(t('commandFailed') + ': ' + error.message);
    process.exit(1);
});
