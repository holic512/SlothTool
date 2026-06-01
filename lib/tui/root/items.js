/**
 * @file RootTuiItems
 * @project SlothTool
 * @module Core CLI / TUI Item Builders
 * @description 为根 TUI 各列表页构建展示 item，隔离数据读取和页面渲染结构。
 * @logic 1. 根据已安装插件和官方目录构建安装/运行/卸载列表；2. 合并官方插件说明与安装来源；3. 根据更新检查结果构建更新列表详情。
 * @dependencies Services: ../../services/plugin-service.js, I18N: ../../i18n.js
 * @index_tags 根TUI, item构建, 插件列表, 更新列表, 设置列表
 * @author holic512
 */

import {t} from '../../i18n.js';
import {getOfficialPlugins, listInstalledPlugins} from '../../services/plugin-service.js';

export function buildInstallItems(language) {
    const installedAliases = new Set(listInstalledPlugins().map(plugin => plugin.alias));
    return getOfficialPlugins()
        .filter(plugin => !installedAliases.has(plugin.alias))
        .map(plugin => ({
            id: plugin.alias,
            title: plugin.alias,
            description: language === 'zh' ? plugin.description : plugin.descriptionEn,
            detail: (language === 'zh' ? plugin.features : plugin.featuresEn).join(', ')
        }));
}

export function buildPluginItems(language = settingsLanguageFallback()) {
    return listInstalledPlugins().map(plugin => ({
        id: plugin.alias,
        alias: plugin.alias,
        title: plugin.alias,
        packageName: plugin.displayName,
        version: plugin.version,
        purpose: resolveInstalledPluginPurpose(plugin.alias, language),
        source: resolveInstalledPluginSource(plugin),
        description: `${plugin.displayName} v${plugin.version}`,
        detail: plugin.sourceLabel
    }));
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

    return [
        {
            id: 'language:zh',
            kind: 'language',
            value: 'zh',
            title: '中文 (Chinese)',
            description: currentSettings.language === 'zh'
                ? t('tui.settings.currentLanguage')
                : t('tui.settings.switchToChinese'),
            detail: 'zh'
        },
        {
            id: 'language:en',
            kind: 'language',
            value: 'en',
            title: 'English',
            description: currentSettings.language === 'en'
                ? t('tui.settings.currentLanguage')
                : t('tui.settings.switchToEnglish'),
            detail: 'en'
        },
        {
            id: 'proxy:enabled',
            kind: 'proxy-enabled',
            title: t('tui.settings.proxyToggle'),
            description: proxySettings.enabled ? t('tui.settings.proxyEnabled') : t('tui.settings.proxyDisabled'),
            detail: `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`
        },
        {
            id: 'proxy:port',
            kind: 'proxy-port',
            title: t('tui.settings.proxyPortPreset'),
            description: t('tui.settings.proxyPortDetail', {
                host: proxySettings.host,
                port: proxySettings.port
            }),
            detail: '7980 / 7890'
        },
        {
            id: 'github:source',
            kind: 'github-source',
            title: t('tui.settings.githubSource'),
            description: getGithubSourceLabel(githubSettings),
            detail: githubSettings.preset === 'custom' && githubSettings.customBaseUrl
                ? githubSettings.customBaseUrl
                : getGithubSourceLabel(githubSettings)
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
            description: plugin.description,
            detail: plugin.detail
        })),
        {
            id: 'uninstall-all',
            kind: 'uninstall-all',
            title: t('tui.actions.uninstallAll'),
            description: '~/.slothtool',
            detail: t('uninstallAll.warning')
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
                detail: t('tui.update.detailReady')
            }
        ];
    }

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
                : t('tui.update.checkDescription')
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
            detail: t('tui.update.checkDescription')
        },
        ...updateCheckSummary.items.map(result => ({
            id: `checked:${result.targetId}`,
            kind: 'checked-target',
            result,
            title: result.title,
            description: t(`tui.update.statusLabels.${result.status}`),
            detail: buildUpdateDetailLines(result)
        }))
    ];
}
