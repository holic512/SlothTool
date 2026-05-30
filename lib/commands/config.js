/**
 * @file ConfigCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理全局配置命令，统一管理语言、代理与 GitHub 源设置。
 * @logic 1. 无参数时展示当前摘要与用法；2. 校验 language/proxy 子命令；3. 写入 settings.json 并反馈结果。
 * @dependencies Settings: ../settings.js, I18N: ../i18n.js, Service: ../services/plugin-service.js
 * @index_tags config命令, language, proxy, github镜像, settings.json
 * @author holic512
 */

import settings from '../settings.js';
import {t} from '../i18n.js';
import {createCliError} from '../services/plugin-service.js';

function printConfigUsage() {
    console.log(t('cli.configUsage'));

    for (const line of t('cli.configHelpLines')) {
        console.log(line);
    }
}

function getGithubPresetLabel(preset) {
    if (preset === 'official') {
        return t('config.githubPresets.official');
    }

    if (preset === 'custom') {
        return t('config.githubPresets.custom');
    }

    return t('config.githubPresets.ghProxy');
}

function printConfigSummary() {
    const currentSettings = settings.readSettings();
    const proxySettings = currentSettings.network.proxy;
    const githubSettings = currentSettings.network.github;
    const githubLabel = getGithubPresetLabel(githubSettings.preset);
    const githubSuffix = githubSettings.preset === 'custom' && githubSettings.customBaseUrl
        ? t('config.customUrlSuffix', {url: githubSettings.customBaseUrl})
        : '';

    console.log(t('config.summaryLanguage', {language: currentSettings.language}));
    console.log(t('config.summaryProxy', {
        status: t(`config.statuses.${proxySettings.enabled ? 'on' : 'off'}`),
        protocol: proxySettings.protocol,
        host: proxySettings.host,
        port: proxySettings.port
    }));
    console.log(t('config.summaryGithub', {
        label: githubLabel,
        suffix: githubSuffix
    }));
}

function handleLanguageConfig(args) {
    const language = args[0];
    if (!language) {
        throw createCliError(t('cli.configUsage'));
    }

    if (!['zh', 'en'].includes(language)) {
        throw createCliError(t('cli.invalidLanguage'));
    }

    settings.setLanguage(language);
    console.log(t('cli.languageSet', {language}));
    return language;
}

function handleProxyEnabledConfig(args) {
    const value = args[0];

    if (!['on', 'off'].includes(value)) {
        throw createCliError(t('config.invalidOnOff'));
    }

    const enabled = value === 'on';
    settings.setProxyEnabled(enabled);
    console.log(t('config.proxyEnabledSet', {
        status: t(`config.statuses.${enabled ? 'on' : 'off'}`)
    }));
    return enabled;
}

function handleProxyHostConfig(args) {
    const host = args[0];

    if (!host?.trim()) {
        throw createCliError(t('cli.configUsage'));
    }

    try {
        const savedHost = settings.setProxyHost(host);
        console.log(t('config.proxyHostSet', {host: savedHost}));
        return savedHost;
    } catch (error) {
        throw createCliError(error.message);
    }
}

function handleProxyPortConfig(args) {
    const port = args[0];

    try {
        const savedPort = settings.setProxyPort(port);
        console.log(t('config.proxyPortSet', {port: savedPort}));
        return savedPort;
    } catch (error) {
        if (error.message.includes('Proxy port')) {
            throw createCliError(t('config.invalidPort'));
        }

        throw createCliError(error.message);
    }
}

function handleGithubPresetConfig(args) {
    const preset = args[0];

    if (!['official', 'gh-proxy', 'custom'].includes(preset)) {
        throw createCliError(t('config.invalidGithubPreset'));
    }

    if (preset === 'custom' && !settings.getNetworkSettings().github.customBaseUrl) {
        throw createCliError(t('config.customUrlRequired'));
    }

    try {
        settings.setGithubPreset(preset);
        console.log(t('config.githubPresetSet', {
            label: getGithubPresetLabel(preset)
        }));
        return preset;
    } catch (error) {
        throw createCliError(error.message);
    }
}

function handleGithubUrlConfig(args) {
    const url = args[0];

    if (!url?.trim()) {
        throw createCliError(t('cli.configUsage'));
    }

    try {
        const savedUrl = settings.setGithubCustomBaseUrl(url);
        console.log(t('config.githubUrlSet', {url: savedUrl}));
        return savedUrl;
    } catch (error) {
        if (error.message.includes('GitHub custom proxy URL')) {
            throw createCliError(t('config.invalidGithubUrl'));
        }

        throw createCliError(error.message);
    }
}

function handleProxyConfig(args) {
    const subCommand = args[0];

    if (!subCommand || subCommand === 'show') {
        printConfigSummary();
        return settings.getNetworkSettings();
    }

    if (subCommand === 'enabled') {
        return handleProxyEnabledConfig(args.slice(1));
    }

    if (subCommand === 'host') {
        return handleProxyHostConfig(args.slice(1));
    }

    if (subCommand === 'port') {
        return handleProxyPortConfig(args.slice(1));
    }

    if (subCommand === 'github') {
        return handleGithubPresetConfig(args.slice(1));
    }

    if (subCommand === 'github-url') {
        return handleGithubUrlConfig(args.slice(1));
    }

    throw createCliError(t('cli.configUsage'));
}

export default function config(args) {
    if (args.length === 0) {
        printConfigSummary();
        printConfigUsage();
        return settings.readSettings();
    }

    const subCommand = args[0];

    if (subCommand === 'language') {
        return handleLanguageConfig(args.slice(1));
    }

    if (subCommand === 'proxy') {
        return handleProxyConfig(args.slice(1));
    }

    throw createCliError(t('cli.configUsage'));
}
