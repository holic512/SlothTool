/**
 * @file RootTuiItems
 * @project SlothTool
 * @module Core CLI / TUI Item Builders
 * @description 为根 TUI 各列表页构建展示 item，隔离数据读取、最近运行排序、状态语义和页面渲染结构。
 * @logic 1. 根据已安装插件和官方目录构建首页、安装/运行/卸载列表；2. 运行页按最近运行时间倒序排列；3. 设置项区分立即应用的预设和需保存的草稿；4. 根据更新检查和批量执行结果生成版本差异与反馈。
 * @dependencies Services: ../../services/plugin-service.js, Constants: ./constants.js, I18N: ../../i18n.js
 * @index_tags 根TUI, item构建, 插件列表, 更新列表, 设置列表
 * @author holic512
 */

import {t} from '../../i18n.js';
import {getOfficialPlugins, listInstalledPlugins} from '../../services/plugin-service.js';
import {ROOT_TUI_COLORS} from './constants.js';

export function buildInstallItems(language) {
    const installedAliases = new Set(listInstalledPlugins().map(plugin => plugin.alias));
    return getOfficialPlugins()
        .filter(plugin => !installedAliases.has(plugin.alias))
        .map(plugin => {
            const features = language === 'zh' ? plugin.features : plugin.featuresEn;

            return {
                id: plugin.alias,
                alias: plugin.alias,
                title: plugin.alias,
                packageName: plugin.packageName,
                author: plugin.author,
                description: language === 'zh' ? plugin.description : plugin.descriptionEn,
                features,
                detail: features.join(', ')
            };
        });
}

export function buildPluginItems(language = settingsLanguageFallback()) {
    return listInstalledPlugins().map(plugin => ({
        id: plugin.alias,
        alias: plugin.alias,
        title: plugin.alias,
        packageName: plugin.displayName,
        version: plugin.version,
        binPath: plugin.binPath || '',
        lastRunAt: plugin.lastRunAt || null,
        purpose: resolveInstalledPluginPurpose(plugin.alias, language),
        features: resolveInstalledPluginFeatures(plugin.alias, language),
        source: resolveInstalledPluginSource(plugin),
        description: `${plugin.displayName} v${plugin.version}`,
        detail: plugin.sourceLabel
    }));
}

export function sortPluginItemsByRecentRun(items = []) {
    return [...items].sort((left, right) => {
        const leftTimestamp = Date.parse(left.lastRunAt || '');
        const rightTimestamp = Date.parse(right.lastRunAt || '');
        const normalizedLeftTimestamp = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;
        const normalizedRightTimestamp = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;

        return normalizedRightTimestamp - normalizedLeftTimestamp
            || left.alias.localeCompare(right.alias);
    });
}

export function buildHomeItems(runItems = []) {
    if (!runItems.length) {
        return [{id: 'home:install', kind: 'open-install', title: t('tui.home.installFirst')}];
    }

    return [
        ...runItems.slice(0, 3).map(plugin => ({
            id: `home:run:${plugin.alias}`,
            kind: 'run-plugin',
            alias: plugin.alias,
            title: plugin.alias,
            description: plugin.purpose
        })),
        {id: 'home:install', kind: 'open-install', title: t('tui.home.openCatalog')}
    ];
}

function resolveInstalledPluginFeatures(alias, language) {
    const officialPlugin = getOfficialPlugins().find(plugin => plugin.alias === alias);

    if (!officialPlugin) {
        return [];
    }

    return language === 'zh' ? officialPlugin.features : officialPlugin.featuresEn;
}

function settingsLanguageFallback() {
    return 'zh';
}

function resolveInstalledPluginPurpose(alias, language) {
    const officialPlugin = getOfficialPlugins().find(plugin => plugin.alias === alias);

    if (!officialPlugin) {
        return t('tui.run.unknownPurpose');
    }

    return language === 'zh' ? officialPlugin.description : officialPlugin.descriptionEn;
}

function resolveInstalledPluginSource(plugin) {
    const officialPlugin = getOfficialPlugins().find(item => item.alias === plugin.alias);

    if (officialPlugin && plugin.sourceLabel) {
        return t('tui.run.officialSource', {source: plugin.sourceLabel});
    }

    return plugin.sourceLabel || t('tui.noDescription');
}

function getGithubSourceLabel(githubSettings) {
    if (githubSettings.preset === 'official') {
        return t('tui.settings.githubOfficial');
    }

    if (githubSettings.preset === 'custom') {
        return t('config.githubPresets.custom');
    }

    return t('tui.settings.githubProxy');
}

export function buildSettingsItems(currentSettings) {
    const proxySettings = currentSettings.network.proxy;
    const githubSettings = currentSettings.network.github;
    const languageLabels = {
        zh: '中文 (Chinese)',
        en: 'English'
    };
    const currentLanguageLabel = languageLabels[currentSettings.language];
    const proxyStatus = t(`config.statuses.${proxySettings.enabled ? 'on' : 'off'}`);
    const nextProxyStatus = t(`config.statuses.${proxySettings.enabled ? 'off' : 'on'}`);
    const currentGithubSource = getGithubSourceLabel(githubSettings);
    const proxyEndpoint = `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`;
    const field = (label, value, valueColor) => ({label, value, valueColor});
    const category = (name) => field(t('tui.settings.fields.category'), t(`tui.settings.categories.${name}`));
    const current = (value) => field(t('tui.settings.fields.current'), value, ROOT_TUI_COLORS.success);
    const next = (value) => field(t('tui.settings.fields.next'), value, ROOT_TUI_COLORS.warning);
    const editorNext = next(t('tui.settings.editBeforeSave'));
    const networkItem = (id, kind, title, description, currentValue, nextValue, detail = '') => ({
        id, kind, title, description, detail,
        badge: t('tui.settings.badges.network'),
        badgeColor: ROOT_TUI_COLORS.accent,
        listMeta: String(currentValue),
        fields: [category('proxy'), current(currentValue), nextValue, field(t('tui.settings.fields.endpoint'), proxyEndpoint)]
    });
    const githubItem = (id, kind, title, currentValue, nextValue, detail = '') => ({
        id, kind, title, detail,
        description: t('tui.settings.descriptions.githubSource'),
        badge: t('tui.settings.badges.github'),
        badgeColor: ROOT_TUI_COLORS.secondary,
        listMeta: githubSettings.preset === id.split(':')[1] ? t('tui.settings.currentBadge') : '',
        fields: [category('github'), current(currentValue), nextValue,
            ...(kind === 'github-custom-edit' ? [field(t('tui.settings.fields.savedCustomUrl'), detail || t('tui.settings.noCustomUrl'))] : [])]
    });

    return [
        {
            id: 'language:zh',
            kind: 'language',
            value: 'zh',
            title: languageLabels.zh,
            description: t('tui.settings.descriptions.language'),
            detail: 'zh',
            badge: currentSettings.language === 'zh'
                ? t('tui.settings.currentBadge')
                : t('tui.settings.badges.language'),
            badgeColor: currentSettings.language === 'zh' ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.secondary,
            listMeta: currentSettings.language === 'zh' ? t('tui.settings.currentBadge') : 'ZH',
            listMetaColor: currentSettings.language === 'zh' ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.muted,
            dimListMeta: currentSettings.language !== 'zh',
            fields: [
                {label: t('tui.settings.fields.category'), value: t('tui.settings.categories.interface')},
                {label: t('tui.settings.fields.current'), value: currentLanguageLabel, valueColor: ROOT_TUI_COLORS.success},
                {label: t('tui.settings.fields.next'), value: languageLabels.zh, valueColor: ROOT_TUI_COLORS.warning}
            ]
        },
        {
            id: 'language:en',
            kind: 'language',
            value: 'en',
            title: 'English',
            description: t('tui.settings.descriptions.language'),
            detail: 'en',
            badge: currentSettings.language === 'en'
                ? t('tui.settings.currentBadge')
                : t('tui.settings.badges.language'),
            badgeColor: currentSettings.language === 'en' ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.secondary,
            listMeta: currentSettings.language === 'en' ? t('tui.settings.currentBadge') : 'EN',
            listMetaColor: currentSettings.language === 'en' ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.muted,
            dimListMeta: currentSettings.language !== 'en',
            fields: [
                {label: t('tui.settings.fields.category'), value: t('tui.settings.categories.interface')},
                {label: t('tui.settings.fields.current'), value: currentLanguageLabel, valueColor: ROOT_TUI_COLORS.success},
                {label: t('tui.settings.fields.next'), value: languageLabels.en, valueColor: ROOT_TUI_COLORS.warning}
            ]
        },
        networkItem('proxy:enabled', 'proxy-enabled', t('tui.settings.proxyToggle'), t('tui.settings.descriptions.proxyToggle'), proxyStatus, next(nextProxyStatus), proxyEndpoint),
        networkItem('proxy:host', 'proxy-host-edit', t('tui.settings.proxyHost'), t('tui.settings.descriptions.proxyHost'), proxySettings.host, editorNext),
        networkItem('proxy:port', 'proxy-port-edit', t('tui.settings.proxyPort'), t('tui.settings.descriptions.proxyPort'), String(proxySettings.port), editorNext),
        ...[7980, 7890].map(port => ({
            ...networkItem(
                `proxy:port:${port}`, 'proxy-port-preset', t('tui.settings.proxyPortPreset', {port}),
                t('tui.settings.descriptions.proxyPortPreset'), String(proxySettings.port), next(String(port))
            ),
            value: port
        })),
        githubItem('github:official', 'github-preset', t('tui.settings.githubOfficial'), currentGithubSource, next(t('tui.settings.githubOfficial'))),
        githubItem('github:gh-proxy', 'github-preset', t('tui.settings.githubProxy'), currentGithubSource, next(t('tui.settings.githubProxy'))),
        githubItem('github:custom', 'github-custom-edit', t('tui.settings.githubCustom'),
            currentGithubSource, editorNext, githubSettings.customBaseUrl)
    ];
}

export function buildUninstallItems(pluginItems) {
    return [
        ...pluginItems.map(plugin => ({
            id: `uninstall:${plugin.alias}`,
            kind: 'uninstall-plugin',
            alias: plugin.alias,
            title: t('tui.actions.uninstallPlugin', {alias: plugin.alias}),
            listLabel: plugin.alias,
            description: plugin.purpose || t('tui.uninstall.pluginDescription'),
            detail: plugin.detail,
            badge: t('tui.uninstall.badges.confirm'),
            badgeColor: ROOT_TUI_COLORS.warning,
            listMeta: `v${plugin.version}`,
            listMetaColor: ROOT_TUI_COLORS.muted,
            fields: [
                {label: t('tui.uninstall.fields.package'), value: plugin.packageName},
                {label: t('tui.uninstall.fields.version'), value: plugin.version},
                {label: t('tui.uninstall.fields.source'), value: plugin.source, dimColor: true},
                {label: t('tui.uninstall.fields.scope'), value: t('tui.uninstall.pluginScope'), valueColor: ROOT_TUI_COLORS.warning},
                {label: t('tui.uninstall.fields.path'), value: plugin.binPath || '-', dimColor: true}
            ]
        })),
        {
            id: 'uninstall-all',
            kind: 'uninstall-all',
            title: t('tui.actions.uninstallAll'),
            listLabel: t('tui.uninstall.allTarget'),
            description: t('tui.uninstall.allDescription'),
            detail: t('uninstallAll.warning'),
            badge: t('tui.uninstall.badges.danger'),
            badgeColor: ROOT_TUI_COLORS.danger,
            listMeta: t('tui.uninstall.badges.danger'),
            listMetaColor: ROOT_TUI_COLORS.danger,
            dimListMeta: false,
            fields: [
                {label: t('tui.uninstall.fields.scope'), value: t('tui.uninstall.allScope'), valueColor: ROOT_TUI_COLORS.danger}
            ]
        }
    ];
}

function buildUpdateDetailLines(result) {
    const lines = [
        t('tui.update.detailCurrent', {version: result.currentVersion || '-'}),
        t('tui.update.detailLatest', {version: result.latestVersion || '-'}),
        t('tui.update.detailSource', {source: result.sourceLabel})
    ];

    if (result.reason) {
        lines.push(t('tui.update.detailReason', {reason: result.reason}));
    }

    return lines.join('\n');
}

export function buildUpdateItems(updateCheckSummary, bulkUpdateSummary = null) {
    if (!updateCheckSummary) {
        return [
            {
                id: 'check-updates',
                kind: 'check-updates',
                title: t('tui.actions.checkUpdates'),
                description: t('tui.update.checkDescription'),
                detail: t('tui.update.detailReady'),
                badge: t('tui.update.badges.check'),
                badgeColor: ROOT_TUI_COLORS.accent,
                listMeta: t('tui.update.pendingSummary'),
                listMetaColor: ROOT_TUI_COLORS.muted,
                fields: [
                    {label: t('tui.update.fields.status'), value: t('tui.update.checkDetail'), valueColor: ROOT_TUI_COLORS.warning},
                    {label: t('tui.update.fields.scope'), value: t('tui.update.scopeAll'), dimColor: true}
                ]
            }
        ];
    }

    const updateStatusColors = {
        unchecked: ROOT_TUI_COLORS.muted,
        latest: ROOT_TUI_COLORS.success,
        outdated: ROOT_TUI_COLORS.warning,
        error: ROOT_TUI_COLORS.danger
    };
    const resultSummary = t('tui.update.resultSummary', {
        outdated: updateCheckSummary.outdatedCount,
        failed: updateCheckSummary.errorCount
    });

    const items = [
        {
            id: 'recheck-updates',
            kind: 'check-updates',
            title: t('tui.actions.recheckUpdates'),
            description: t('tui.update.checkedSummary', {
                outdated: updateCheckSummary.outdatedCount,
                failed: updateCheckSummary.errorCount
            }),
            detail: updateCheckSummary.outdatedCount === 0 && updateCheckSummary.errorCount === 0
                ? t('tui.update.latestSummary')
                : t('tui.update.checkDescription'),
            badge: t('tui.update.badges.recheck'),
            badgeColor: ROOT_TUI_COLORS.accent,
            listMeta: t('tui.update.badges.recheck'),
            listMetaColor: ROOT_TUI_COLORS.accent,
            dimListMeta: false,
            fields: [
                {label: t('tui.update.fields.status'), value: resultSummary, valueColor: updateCheckSummary.errorCount > 0 ? ROOT_TUI_COLORS.danger : ROOT_TUI_COLORS.success},
                {label: t('tui.update.fields.scope'), value: t('tui.update.scopeAll'), dimColor: true}
            ]
        },
        {
            id: 'update-outdated',
            kind: 'update-outdated',
            actionable: updateCheckSummary.outdatedCount > 0,
            title: t('tui.actions.updateOutdated'),
            description: updateCheckSummary.outdatedCount > 0
                ? t('tui.update.checkedSummary', {
                    outdated: updateCheckSummary.outdatedCount,
                    failed: updateCheckSummary.errorCount
                })
                : t('tui.update.noneOutdated'),
            detail: t('tui.update.checkDescription'),
            badge: t('tui.update.badges.bulk'),
            badgeColor: updateCheckSummary.outdatedCount > 0 ? ROOT_TUI_COLORS.warning : ROOT_TUI_COLORS.success,
            listMeta: t(`tui.update.statusLabels.${updateCheckSummary.outdatedCount > 0 ? 'outdated' : 'latest'}`),
            listMetaColor: updateCheckSummary.outdatedCount > 0 ? ROOT_TUI_COLORS.warning : ROOT_TUI_COLORS.muted,
            fields: [
                {label: t('tui.update.fields.scope'), value: t('tui.update.bulkScope', {count: updateCheckSummary.outdatedCount}), valueColor: updateCheckSummary.outdatedCount > 0 ? ROOT_TUI_COLORS.warning : ROOT_TUI_COLORS.success},
                {label: t('tui.update.fields.failures'), value: String(updateCheckSummary.errorCount), valueColor: updateCheckSummary.errorCount > 0 ? ROOT_TUI_COLORS.danger : ROOT_TUI_COLORS.success}
            ]
        },
        ...updateCheckSummary.items.map(result => ({
            id: `checked:${result.targetId}`,
            kind: 'checked-target',
            result,
            title: result.title,
            description: t(`tui.update.targetDescriptions.${result.kind}`),
            detail: buildUpdateDetailLines(result),
            badge: t(`tui.update.statusLabels.${result.status}`),
            badgeColor: updateStatusColors[result.status] || ROOT_TUI_COLORS.muted,
            listMeta: t(`tui.update.statusLabels.${result.status}`),
            listMetaColor: updateStatusColors[result.status] || ROOT_TUI_COLORS.muted,
            dimListMeta: false,
            fields: [
                {label: t('tui.update.fields.current'), value: result.currentVersion || '-'},
                {label: t('tui.update.fields.latest'), value: result.latestVersion || '-', valueColor: updateStatusColors[result.status] || ROOT_TUI_COLORS.muted},
                {label: t('tui.update.fields.source'), value: result.sourceLabel, dimColor: true},
                ...(result.reason
                    ? [{label: t('tui.update.fields.reason'), value: result.reason, valueColor: ROOT_TUI_COLORS.danger}]
                    : [])
            ]
        }))
    ];

    if (bulkUpdateSummary) {
        items.push({
            id: 'last-batch',
            kind: 'batch-result',
            title: t('tui.update.batchResults'),
            description: t('update.allSummary', bulkUpdateSummary),
            listMeta: bulkUpdateSummary.failed ? t('tui.status.phases.partial') : t('tui.status.phases.success'),
            listMetaColor: bulkUpdateSummary.failed ? ROOT_TUI_COLORS.warning : ROOT_TUI_COLORS.success,
            fields: [
                {label: t('tui.update.fields.scope'), value: String(bulkUpdateSummary.total)},
                {label: t('tui.update.fields.failures'), value: String(bulkUpdateSummary.failed)}
            ],
            detailItems: bulkUpdateSummary.results.map(result => result.reason
                ? `${result.title}: ${t(`tui.feedback.result.${result.status}`)} — ${result.reason}`
                : `${result.title}: ${t(`tui.feedback.result.${result.status}`)}`),
            detailLabel: t('tui.feedback.targets')
        });
    }

    return items;
}
