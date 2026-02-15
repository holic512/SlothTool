const prompts = require('prompts');
const {t} = require('./i18n');
const config = require('./config');
const history = require('./history');
const systemd = require('./systemd');

function formatServiceChoice(service) {
    const description = `${service.load} ${service.active} ${service.sub}`;
    const title = `${service.unit} - ${service.description}`;
    return {title, value: service.unit, description};
}

function formatActionLabel(action) {
    switch (action) {
        case 'start':
            return t('commandStart');
        case 'stop':
            return t('commandStop');
        case 'restart':
            return t('commandRestart');
        case 'enable':
            return t('commandEnable');
        case 'disable':
            return t('commandDisable');
        case 'status':
            return t('commandStatus');
        case 'logs':
            return t('commandLogs');
        default:
            return action;
    }
}

function printResult(result, action, service) {
    if (result.success) {
        if (result.stdout && !result.streamed) {
            process.stdout.write(result.stdout);
        }
        if (!result.streamed) {
            console.log(t('actionSuccess'));
        }
    } else {
        console.error(t('actionFailed') + ': ' + (result.message || t('unknownError')));
        if (systemd.detectPermissionError(result.message || result.stderr)) {
            console.error(t('permissionDenied'));
            const suggestion = action === 'logs'
                ? `sudo journalctl -u ${service}`
                : action === 'list'
                    ? 'sudo systemctl list-units --type=service'
                    : `sudo systemctl ${action} ${service}`;
            console.error(t('suggestion') + ' ' + suggestion);
        }
    }
}

async function chooseServiceByList() {
    const search = await prompts({
        type: 'text',
        name: 'keyword',
        message: t('promptSearch')
    });
    if (search.keyword) {
        history.addRecentSearch(search.keyword);
    }
    const state = await prompts({
        type: 'select',
        name: 'state',
        message: t('promptState'),
        choices: [
            {title: t('stateAll'), value: 'all'},
            {title: t('stateActive'), value: 'active'},
            {title: t('stateInactive'), value: 'inactive'},
            {title: t('stateFailed'), value: 'failed'}
        ]
    });
    const filterState = state.state === 'all' ? undefined : state.state;
    const list = await systemd.listServices({
        all: state.state === 'all',
        state: filterState,
        pattern: search.keyword || undefined,
        forInteractive: true
    });
    if (!list.result.success) {
        printResult(list.result, 'list', '');
        return null;
    }
    if (list.services.length === 0) {
        console.log(t('noServicesFound'));
        return null;
    }
    const serviceChoice = await prompts({
        type: 'select',
        name: 'service',
        message: t('promptService'),
        choices: list.services.map(formatServiceChoice)
    });
    if (!serviceChoice.service) {
        return null;
    }
    return serviceChoice.service;
}

async function inputServiceName() {
    const response = await prompts({
        type: 'text',
        name: 'service',
        message: t('promptServiceName'),
        validate: value => systemd.validateServiceName(value) || t('invalidServiceName')
    });
    return response.service || null;
}

async function confirmIfDangerous(action) {
    const cfg = config.readConfig();
    if (!cfg.confirmDangerous) return true;
    if (action === 'stop') {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: t('promptConfirmStop'),
            initial: false
        });
        return !!confirm.ok;
    }
    if (action === 'disable') {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: t('promptConfirmDisable'),
            initial: false
        });
        return !!confirm.ok;
    }
    if (action === 'restart') {
        const confirm = await prompts({
            type: 'confirm',
            name: 'ok',
            message: t('promptConfirmRestart'),
            initial: true
        });
        return !!confirm.ok;
    }
    return true;
}

async function runAction(action, service) {
    if (!service) return;
    let result;
    switch (action) {
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
        case 'logs':
            result = await systemd.showLogs(service, {lines: config.readConfig().logLines});
            break;
        default:
            return;
    }
    printResult(result, action, service);
    if (result.success) {
        history.addRecentService(service);
    }
    history.addAction(systemd.buildResult(action, service, result));
}

async function quickActionsMenu() {
    const hist = history.readHistory();
    const hasActions = hist.actions.length > 0;
    const hasServices = hist.recentServices.length > 0;
    if (!hasActions && !hasServices) {
        console.log(t('historyEmpty'));
        return;
    }

    const modeResponse = await prompts({
        type: 'select',
        name: 'mode',
        message: t('menuQuickActions'),
        choices: [
            {title: t('quickActionRecentActions'), value: 'actions', disabled: !hasActions},
            {title: t('quickActionRecentService'), value: 'service', disabled: !hasServices},
            {title: t('menuExit'), value: 'exit'}
        ]
    });

    if (!modeResponse.mode || modeResponse.mode === 'exit') {
        return;
    }

    if (modeResponse.mode === 'actions') {
        const actionChoices = hist.actions.map((entry, index) => {
            const label = `${entry.time} - ${formatActionLabel(entry.action)} ${entry.service} (${entry.result})`;
            return {title: label, value: index};
        });
        const response = await prompts({
            type: 'select',
            name: 'actionIndex',
            message: t('quickActionRecentActions'),
            choices: [
                ...actionChoices,
                {title: t('menuExit'), value: '__exit__'}
            ]
        });
        if (response.actionIndex === undefined || response.actionIndex === '__exit__') return;
        const selected = hist.actions[response.actionIndex];
        if (!selected) return;
        await runAction(selected.action, selected.service);
        return;
    }

    if (modeResponse.mode === 'service') {
        const serviceResponse = await prompts({
            type: 'select',
            name: 'service',
            message: t('promptService'),
            choices: hist.recentServices.slice(0, 10).map(service => ({
                title: service,
                value: service
            }))
        });
        if (!serviceResponse.service) return;

        const actionResponse = await prompts({
            type: 'select',
            name: 'action',
            message: t('promptAction'),
            choices: [
                {title: t('commandStart'), value: 'start'},
                {title: t('commandStop'), value: 'stop'},
                {title: t('commandRestart'), value: 'restart'},
                {title: t('commandEnable'), value: 'enable'},
                {title: t('commandDisable'), value: 'disable'},
                {title: t('commandStatus'), value: 'status'},
                {title: t('commandLogs'), value: 'logs'}
            ]
        });
        if (!actionResponse.action) return;

        if (['stop', 'disable', 'restart'].includes(actionResponse.action)) {
            const confirmed = await confirmIfDangerous(actionResponse.action);
            if (!confirmed) return;
        }

        if (actionResponse.action === 'logs') {
            await handleLogsFlow(serviceResponse.service);
            return;
        }

        await runAction(actionResponse.action, serviceResponse.service);
    }
}

async function historyMenu() {
    const hist = history.readHistory();
    if (!hist.actions.length && !hist.recentServices.length && !hist.recentSearches.length) {
        console.log(t('historyEmpty'));
        return;
    }
    console.log(t('historyActionsTitle'));
    hist.actions.slice(0, 10).forEach(entry => {
        console.log(`  ${entry.time} ${formatActionLabel(entry.action)} ${entry.service} (${entry.result})`);
    });
    console.log('\n' + t('historyServicesTitle'));
    hist.recentServices.slice(0, 10).forEach(service => console.log('  ' + service));
    console.log('\n' + t('historySearchesTitle'));
    hist.recentSearches.slice(0, 10).forEach(search => console.log('  ' + search));

    const response = await prompts({
        type: 'confirm',
        name: 'clear',
        message: t('historyClearConfirm'),
        initial: false
    });
    if (response.clear) {
        history.clearHistory();
        console.log(t('historyCleared'));
    }
}

async function settingsMenu() {
    const cfg = config.readConfig();
    const logLinesResponse = await prompts({
        type: 'number',
        name: 'logLines',
        message: t('settingsLogLines'),
        initial: cfg.logLines,
        min: 1
    });
    const confirmResponse = await prompts({
        type: 'confirm',
        name: 'confirmDangerous',
        message: t('settingsConfirmDangerous'),
        initial: cfg.confirmDangerous
    });
    const historyResponse = await prompts({
        type: 'number',
        name: 'actionsLimit',
        message: `${t('settingsHistoryLimits')} (actions)`,
        initial: cfg.historyLimits.actions,
        min: 1
    });
    const servicesResponse = await prompts({
        type: 'number',
        name: 'servicesLimit',
        message: `${t('settingsHistoryLimits')} (services)`,
        initial: cfg.historyLimits.services,
        min: 1
    });
    const searchesResponse = await prompts({
        type: 'number',
        name: 'searchesLimit',
        message: `${t('settingsHistoryLimits')} (searches)`,
        initial: cfg.historyLimits.searches,
        min: 1
    });

    const newConfig = {
        logLines: logLinesResponse.logLines || cfg.logLines,
        confirmDangerous: confirmResponse.confirmDangerous ?? cfg.confirmDangerous,
        historyLimits: {
            actions: historyResponse.actionsLimit || cfg.historyLimits.actions,
            services: servicesResponse.servicesLimit || cfg.historyLimits.services,
            searches: searchesResponse.searchesLimit || cfg.historyLimits.searches
        }
    };
    config.writeConfig(newConfig);
    console.log(t('settingsSaved'));
}

async function handleLogsFlow(service) {
    const cfg = config.readConfig();
    const linesResponse = await prompts({
        type: 'number',
        name: 'lines',
        message: t('promptLogLines'),
        initial: cfg.logLines,
        min: 1
    });
    const followResponse = await prompts({
        type: 'confirm',
        name: 'follow',
        message: t('promptLogFollow'),
        initial: false
    });
    const sinceResponse = await prompts({
        type: 'text',
        name: 'since',
        message: t('promptLogSince')
    });
    const result = await systemd.showLogs(service, {
        lines: linesResponse.lines || cfg.logLines,
        follow: !!followResponse.follow,
        since: sinceResponse.since || undefined
    });
    printResult(result, 'logs', service);
    if (result.success) {
        history.addRecentService(service);
    }
    history.addAction(systemd.buildResult('logs', service, result));
}

async function interactiveMain() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: [
                {title: t('menuQuickActions'), value: 'quick'},
                {title: t('menuListChoose'), value: 'listChoose'},
                {title: t('menuStart'), value: 'start'},
                {title: t('menuStop'), value: 'stop'},
                {title: t('menuRestart'), value: 'restart'},
                {title: t('menuEnable'), value: 'enable'},
                {title: t('menuDisable'), value: 'disable'},
                {title: t('menuStatus'), value: 'status'},
                {title: t('menuLogs'), value: 'logs'},
                {title: t('menuHistory'), value: 'history'},
                {title: t('menuSettings'), value: 'settings'},
                {title: t('menuExit'), value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        if (response.action === 'quick') {
            await quickActionsMenu();
        } else if (response.action === 'listChoose') {
            const service = await chooseServiceByList();
            if (service) {
                history.addRecentService(service);
                console.log(service);
            }
        } else if (response.action === 'start') {
            const service = await inputServiceName();
            if (service) {
                await runAction('start', service);
            }
        } else if (response.action === 'stop') {
            const service = await inputServiceName();
            if (service && await confirmIfDangerous('stop')) {
                await runAction('stop', service);
            }
        } else if (response.action === 'restart') {
            const service = await inputServiceName();
            if (service && await confirmIfDangerous('restart')) {
                await runAction('restart', service);
            }
        } else if (response.action === 'enable') {
            const service = await inputServiceName();
            if (service) {
                await runAction('enable', service);
            }
        } else if (response.action === 'disable') {
            const service = await inputServiceName();
            if (service && await confirmIfDangerous('disable')) {
                await runAction('disable', service);
            }
        } else if (response.action === 'status') {
            const service = await inputServiceName();
            if (service) {
                await runAction('status', service);
            }
        } else if (response.action === 'logs') {
            const service = await inputServiceName();
            if (service) {
                await handleLogsFlow(service);
            }
        } else if (response.action === 'history') {
            await historyMenu();
        } else if (response.action === 'settings') {
            await settingsMenu();
        }

        console.log('');
    }
}

module.exports = {
    interactiveMain
};
