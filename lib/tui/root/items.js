/**
 * @file RootTuiItems
 * @project SlothTool
 * @module Core CLI / TUI Item Builders
 * @description 为根 TUI 各列表页构建展示 item，隔离数据读取、最近运行排序、状态语义和页面渲染结构。
 * @logic 1. 根据已安装插件和官方目录构建安装/运行/卸载列表；2. 运行页按最近运行时间倒序排列且让未运行项按别名稳定排序；3. 将设置当前值与下一值整理为可预览字段；4. 根据更新检查结果生成状态颜色、版本差异和批量范围。
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
    const currentGithubValue = githubSettings.preset === 'custom' && githubSettings.customBaseUrl
        ? githubSettings.customBaseUrl
        : currentGithubSource;
    const nextGithubSource = githubSettings.preset === 'official'
        ? t('tui.settings.githubProxy')
        : t('tui.settings.githubOfficial');
    const nextProxyPort = proxySettings.port === 7980 ? 7890 : 7980;
    const proxyEndpoint = `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`;

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
        {
            id: 'proxy:enabled',
            kind: 'proxy-enabled',
            title: t('tui.settings.proxyToggle'),
            description: t('tui.settings.descriptions.proxyToggle'),
            detail: proxyEndpoint,
            badge: t('tui.settings.badges.network'),
            badgeColor: ROOT_TUI_COLORS.accent,
            listMeta: proxyStatus,
            listMetaColor: proxySettings.enabled ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.warning,
            dimListMeta: false,
            fields: [
                {label: t('tui.settings.fields.category'), value: t('tui.settings.categories.proxy')},
                {label: t('tui.settings.fields.current'), value: proxyStatus, valueColor: proxySettings.enabled ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.warning},
                {label: t('tui.settings.fields.next'), value: nextProxyStatus, valueColor: ROOT_TUI_COLORS.warning},
                {label: t('tui.settings.fields.endpoint'), value: proxyEndpoint, dimColor: true}
            ]
        },
        {
            id: 'proxy:port',
            kind: 'proxy-port',
            title: t('tui.settings.proxyPortPreset'),
            description: t('tui.settings.descriptions.proxyPort'),
            detail: '7980 / 7890',
            badge: t('tui.settings.badges.network'),
            badgeColor: ROOT_TUI_COLORS.accent,
            listMeta: String(proxySettings.port),
            listMetaColor: ROOT_TUI_COLORS.accent,
            dimListMeta: false,
            fields: [
                {label: t('tui.settings.fields.category'), value: t('tui.settings.categories.proxy')},
                {label: t('tui.settings.fields.current'), value: String(proxySettings.port), valueColor: ROOT_TUI_COLORS.success},
                {label: t('tui.settings.fields.next'), value: String(nextProxyPort), valueColor: ROOT_TUI_COLORS.warning},
                {label: t('tui.settings.fields.endpoint'), value: proxyEndpoint, dimColor: true}
            ]
        },
        {
            id: 'github:source',
            kind: 'github-source',
            title: t('tui.settings.githubSource'),
            description: t('tui.settings.descriptions.githubSource'),
            detail: githubSettings.preset === 'custom' && githubSettings.customBaseUrl
                ? githubSettings.customBaseUrl
                : currentGithubSource,
            badge: t('tui.settings.badges.github'),
            badgeColor: ROOT_TUI_COLORS.secondary,
            listMeta: currentGithubSource,
            listMetaColor: githubSettings.preset === 'official' ? ROOT_TUI_COLORS.success : ROOT_TUI_COLORS.secondary,
            dimListMeta: false,
            fields: [
                {label: t('tui.settings.fields.category'), value: t('tui.settings.categories.github')},
                {label: t('tui.settings.fields.current'), value: currentGithubValue, valueColor: ROOT_TUI_COLORS.success},
                {label: t('tui.settings.fields.next'), value: nextGithubSource, valueColor: ROOT_TUI_COLORS.warning}
            ]
        }
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
                {label: t('tui.uninstall.fields.scope'), value: t('tui.uninstall.pluginScope'), valueColor: ROOT_TUI_COLORS.warning}
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

export function buildUpdateItems(updateCheckSummary) {
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

    return [
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
}
