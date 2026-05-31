/**
 * @file SlothToolPluginService
 * @project SlothTool
 * @module Core CLI / Services
 * @description 提供官方插件安装、更新、卸载、运行、自更新和全量数据删除等无 UI 生命周期能力，并统一接入代理与 GitHub 镜像配置。
 * @logic 1. 用 reporter 事件输出进度；2. 统一处理 GitHub Release 与遗留 npm 来源插件；3. 为 GitHub 请求与 npm 命令注入网络配置，并按当前系统选择目标平台资产。
 * @dependencies Node: child_process/fs/https/os/path, Storage: ../registry.js, Settings: ../settings.js, Network: ./network-helper.js, Data: ../official-plugins.json, I18N: ../i18n.js, System: ./system-environment.js
 * @index_tags 插件服务, 生命周期, GitHub Release, 平台资产, 代理配置, reporter, CLI底层
 * @author holic512
 */

import {execFileSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import registry from '../registry.js';
import {t} from '../i18n.js';
import officialPluginsCatalog from '../official-plugins.json' with {type: 'json'};
import rootPackage from '../../package.json' with {type: 'json'};
import settings from '../settings.js';
import {
    buildProxyAgent,
    buildProxyEnv,
    rewriteGithubUrl
} from './network-helper.js';
import {getSystemEnvironment} from './system-environment.js';
import {
    ensureDir,
    getPluginConfigPath,
    getPluginDir,
    getPluginsDir,
    getSlothToolHome,
    removePath
} from '../utils.js';

const officialPlugins = officialPluginsCatalog.officialPlugins;
const officialPluginMap = new Map(officialPlugins.map(plugin => [plugin.alias, plugin]));
const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_UPDATE_CHECK_STATUS = 'unchecked';

function report(reporter, level, message, meta = {}) {
    reporter?.({level, message, ...meta});
}

function getNpmBinary() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function normalizeVersionText(version) {
    return String(version || '').trim().replace(/^['"]|['"]$/gu, '');
}

function parseVersion(version) {
    const match = normalizeVersionText(version).match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);

    if (!match) {
        return null;
    }

    return [match[1], match[2] || '0', match[3] || '0'].map(value => Number.parseInt(value, 10));
}

function compareVersions(leftVersion, rightVersion) {
    const left = parseVersion(leftVersion);
    const right = parseVersion(rightVersion);

    if (!left || !right) {
        return null;
    }

    for (let index = 0; index < 3; index += 1) {
        if (left[index] > right[index]) {
            return 1;
        }

        if (left[index] < right[index]) {
            return -1;
        }
    }

    return 0;
}

function runCommand(command, args, options = {}) {
    try {
        return execFileSync(command, args, {
            cwd: options.cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024,
            env: {
                ...process.env,
                ...options.env
            }
        });
    } catch (error) {
        const stderr = String(error.stderr || '').trim();
        const stdout = String(error.stdout || '').trim();
        const reason = stderr || stdout || error.message;
        throw new Error(reason);
    }
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveBinRelativePath(pkg) {
    if (typeof pkg.bin === 'string') {
        return pkg.bin;
    }

    if (pkg.bin && typeof pkg.bin === 'object') {
        const [binKey] = Object.keys(pkg.bin);
        return pkg.bin[binKey];
    }

    throw new Error(`No bin field found in package.json for ${pkg.name}.`);
}

function resolveBinPath(installRoot, pkg) {
    const binPath = path.join(installRoot, resolveBinRelativePath(pkg));

    if (!fs.existsSync(binPath)) {
        throw new Error(`Bin file not found at: ${binPath}`);
    }

    return binPath;
}

function copyDirectoryContents(sourceDir, targetDir) {
    ensureDir(targetDir);

    for (const entry of fs.readdirSync(sourceDir, {withFileTypes: true})) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        const stats = fs.lstatSync(sourcePath);

        if (entry.isDirectory()) {
            ensureDir(targetPath);
            fs.chmodSync(targetPath, stats.mode);
            copyDirectoryContents(sourcePath, targetPath);
            continue;
        }

        if (entry.isSymbolicLink()) {
            fs.symlinkSync(fs.readlinkSync(sourcePath), targetPath);
            continue;
        }

        fs.copyFileSync(sourcePath, targetPath);
        fs.chmodSync(targetPath, stats.mode);
    }
}

function deployStagedPlugin(alias, stagedDir) {
    const pluginDir = getPluginDir(alias);
    const pluginsDir = getPluginsDir();
    const backupDir = fs.existsSync(pluginDir)
        ? path.join(pluginsDir, `.${alias}.backup.${Date.now()}`)
        : null;

    try {
        if (backupDir) {
            fs.renameSync(pluginDir, backupDir);
        }

        removePath(pluginDir);
        ensureDir(pluginDir);
        copyDirectoryContents(stagedDir, pluginDir);
    } catch (error) {
        removePath(pluginDir);

        if (backupDir && fs.existsSync(backupDir)) {
            fs.renameSync(backupDir, pluginDir);
        }

        throw error;
    }

    if (backupDir && fs.existsSync(backupDir)) {
        removePath(backupDir);
    }

    return pluginDir;
}

function createGithubRequestOptions(url, acceptHeader, currentSettings) {
    return {
        url: rewriteGithubUrl(url, currentSettings),
        options: {
            agent: buildProxyAgent(currentSettings),
            headers: {
                Accept: acceptHeader,
                'User-Agent': 'SlothTool'
            }
        }
    };
}

function resolveRedirectUrl(location, currentUrl, currentSettings) {
    const redirectUrl = new URL(location, currentUrl).href;
    return rewriteGithubUrl(redirectUrl, currentSettings);
}

function getNetworkSettingsSnapshot() {
    return settings.readSettings();
}

function getProxyCommandEnv() {
    return buildProxyEnv(getNetworkSettingsSnapshot());
}

function fetchLatestRegistryVersion(packageName) {
    const version = runCommand(getNpmBinary(), ['view', packageName, 'version'], {
        env: getProxyCommandEnv()
    });

    return normalizeVersionText(version);
}

function resolveUpdateStatus(currentVersion, latestVersion, {needsMigration = false} = {}) {
    if (needsMigration) {
        return 'outdated';
    }

    if (normalizeVersionText(currentVersion) === normalizeVersionText(latestVersion)) {
        return 'latest';
    }

    const comparison = compareVersions(currentVersion, latestVersion);
    if (comparison === null) {
        return 'outdated';
    }

    return comparison >= 0 ? 'latest' : 'outdated';
}

function createUpdateCheckResult({
    targetId,
    kind,
    title,
    currentVersion,
    latestVersion,
    status = DEFAULT_UPDATE_CHECK_STATUS,
    sourceLabel,
    reason = ''
}) {
    return {
        targetId,
        kind,
        title,
        currentVersion: normalizeVersionText(currentVersion),
        latestVersion: normalizeVersionText(latestVersion),
        status,
        sourceLabel,
        reason
    };
}

function githubRequestJson(url, currentSettings = getNetworkSettingsSnapshot()) {
    return new Promise((resolve, reject) => {
        const requestConfig = createGithubRequestOptions(url, 'application/vnd.github+json', currentSettings);
        const request = https.get(requestConfig.url, requestConfig.options, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                githubRequestJson(
                    resolveRedirectUrl(response.headers.location, requestConfig.url, currentSettings),
                    currentSettings
                ).then(resolve).catch(reject);
                return;
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`GitHub API request failed (${response.statusCode}): ${body.slice(0, 300)}`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
                }
            });
        });

        request.on('error', reject);
    });
}

function downloadFile(url, targetPath, redirectCount = 0, currentSettings = getNetworkSettingsSnapshot()) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Too many redirects while downloading the plugin asset.'));
            return;
        }

        const requestConfig = createGithubRequestOptions(url, 'application/octet-stream', currentSettings);
        const request = https.get(requestConfig.url, requestConfig.options, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                downloadFile(
                    resolveRedirectUrl(response.headers.location, requestConfig.url, currentSettings),
                    targetPath,
                    redirectCount + 1,
                    currentSettings
                ).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`Failed to download plugin asset (${response.statusCode}).`));
                return;
            }

            const fileStream = fs.createWriteStream(targetPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => fileStream.close(resolve));
            fileStream.on('error', error => {
                fileStream.close(() => {
                    removePath(targetPath);
                    reject(error);
                });
            });
        });

        request.on('error', reject);
    });
}

function extractReleaseVersion(pluginMeta, release) {
    return release.tag_name.replace(pluginMeta.releaseTagPrefix, '');
}

function getOfficialAssetStrategy(pluginMeta) {
    return pluginMeta.assetStrategy === 'platform-target' ? 'platform-target' : 'generic';
}

function getSupportedTargets(pluginMeta, release) {
    if (Array.isArray(pluginMeta.supportedTargets) && pluginMeta.supportedTargets.length > 0) {
        return [...pluginMeta.supportedTargets];
    }

    return (release.assets || [])
        .filter(item => typeof item.name === 'string' && item.name.startsWith(pluginMeta.assetNamePrefix) && item.name.endsWith('.tgz'))
        .map(item => extractTargetFromAssetName(item.name))
        .filter(Boolean);
}

function extractTargetFromAssetName(assetName) {
    const match = assetName.match(/-(windows|linux|macos)-(amd64|arm64|arm|386)\.tgz$/u);
    return match ? `${match[1]}-${match[2]}` : '';
}

export function selectReleaseAssetForEnvironment(pluginMeta, release, systemEnvironment = getSystemEnvironment()) {
    const matchingAssets = (release.assets || []).filter(item =>
        typeof item.name === 'string' &&
        item.name.startsWith(pluginMeta.assetNamePrefix) &&
        item.name.endsWith('.tgz')
    );

    if (matchingAssets.length === 0) {
        throw new Error(`No release asset found for ${pluginMeta.alias} in ${release.tag_name}.`);
    }

    if (getOfficialAssetStrategy(pluginMeta) !== 'platform-target') {
        return {
            asset: matchingAssets[0],
            target: 'generic'
        };
    }

    const expectedSuffix = `-${systemEnvironment.target}.tgz`;
    const targetAsset = matchingAssets.find(item => item.name.endsWith(expectedSuffix));

    if (!targetAsset) {
        const supportedTargets = getSupportedTargets(pluginMeta, release);
        throw new Error(
            `No release asset found for ${pluginMeta.alias} on ${systemEnvironment.target}. Available targets: ${supportedTargets.join(', ')}.`
        );
    }

    return {
        asset: targetAsset,
        target: systemEnvironment.target
    };
}

async function fetchLatestOfficialRelease(pluginMeta, options = {}) {
    const systemEnvironment = options.systemEnvironment || getSystemEnvironment();
    let page = 1;

    while (true) {
        const releases = await githubRequestJson(
            `${GITHUB_API_BASE}/repos/${pluginMeta.repository}/releases?per_page=50&page=${page}`
        );

        if (!Array.isArray(releases) || releases.length === 0) {
            break;
        }

        const matchingRelease = releases.find(release =>
            !release.draft &&
            !release.prerelease &&
            typeof release.tag_name === 'string' &&
            release.tag_name.startsWith(pluginMeta.releaseTagPrefix)
        );

        if (matchingRelease) {
            const selected = selectReleaseAssetForEnvironment(pluginMeta, matchingRelease, systemEnvironment);

            return {
                asset: selected.asset,
                release: matchingRelease,
                version: extractReleaseVersion(pluginMeta, matchingRelease),
                target: selected.target,
                systemEnvironment
            };
        }

        page += 1;
    }

    throw new Error(`No GitHub release found for official plugin "${pluginMeta.alias}".`);
}

async function stageOfficialPluginRelease(pluginMeta, releaseInfo, reporter) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-plugin-'));
    const tarballPath = path.join(tempRoot, releaseInfo.asset.name);
    const extractDir = path.join(tempRoot, 'extract');
    const buildDir = path.join(tempRoot, 'build');
    const proxyCommandEnv = getProxyCommandEnv();

    ensureDir(extractDir);
    ensureDir(buildDir);

    try {
        report(reporter, 'info', t('install.downloadingAsset', {assetName: releaseInfo.asset.name}));
        await downloadFile(releaseInfo.asset.browser_download_url, tarballPath);

        runCommand('tar', ['-xzf', tarballPath, '-C', extractDir]);

        const packageRoot = path.join(extractDir, 'package');
        const packageJsonPath = path.join(packageRoot, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`package.json not found in release asset: ${releaseInfo.asset.name}`);
        }

        copyDirectoryContents(packageRoot, buildDir);
        report(reporter, 'info', t('install.installingDependencies'));
        runCommand(getNpmBinary(), ['install', '--omit=dev'], {
            cwd: buildDir,
            env: proxyCommandEnv
        });

        const pkg = readJson(path.join(buildDir, 'package.json'));
        const binPath = resolveBinPath(buildDir, pkg);

        return {
            binRelativePath: path.relative(buildDir, binPath),
            packageJson: pkg,
            stagedDir: buildDir,
            tempRoot
        };
    } catch (error) {
        removePath(tempRoot);
        throw error;
    }
}

async function installOfficialPluginRelease(alias, pluginMeta, releaseInfo, reporter, existingPlugin = null) {
    const staged = await stageOfficialPluginRelease(pluginMeta, releaseInfo, reporter);

    try {
        const pluginDir = deployStagedPlugin(alias, staged.stagedDir);
        const now = new Date().toISOString();
        const registryEntry = {
            name: pluginMeta.packageName,
            packageName: pluginMeta.packageName,
            version: staged.packageJson.version,
            binPath: path.join(pluginDir, staged.binRelativePath),
            installedAt: existingPlugin ? existingPlugin.installedAt : now,
            sourceType: 'github-release',
            repository: pluginMeta.repository,
            releaseTag: releaseInfo.release.tag_name,
            assetName: releaseInfo.asset.name,
            installTarget: releaseInfo.target || 'generic'
        };

        if (existingPlugin) {
            registryEntry.updatedAt = now;
        }

        registry.addPlugin(alias, registryEntry);
        return registryEntry;
    } finally {
        removePath(staged.tempRoot);
    }
}

function getPluginDisplayName(pluginInfo) {
    return pluginInfo.packageName || pluginInfo.name;
}

function updateLegacyRegistryEntry(alias, plugin, pkg, pluginRoot) {
    const now = new Date().toISOString();
    registry.addPlugin(alias, {
        ...plugin,
        name: getPluginDisplayName(plugin),
        packageName: getPluginDisplayName(plugin),
        version: pkg.version,
        binPath: resolveBinPath(pluginRoot, pkg),
        installedAt: plugin.installedAt,
        updatedAt: now,
        sourceType: plugin.sourceType || 'npm-registry'
    });
}

async function updateOfficialPlugin(alias, plugin, pluginMeta, reporter) {
    const releaseInfo = await fetchLatestOfficialRelease(pluginMeta);
    const needsMigration = plugin.sourceType !== 'github-release';

    if (!needsMigration && plugin.version === releaseInfo.version && plugin.releaseTag === releaseInfo.release.tag_name) {
        return {
            status: 'latest',
            version: plugin.version
        };
    }

    const updatedPlugin = await installOfficialPluginRelease(alias, pluginMeta, releaseInfo, reporter, plugin);

    if (needsMigration && plugin.version === updatedPlugin.version) {
        return {
            status: 'migrated',
            version: updatedPlugin.version
        };
    }

    return {
        status: 'updated',
        oldVersion: plugin.version,
        newVersion: updatedPlugin.version
    };
}

function updateLegacyPlugin(alias, plugin) {
    const pluginDir = getPluginDir(alias);
    const packageName = getPluginDisplayName(plugin);
    const packageRoot = path.join(pluginDir, 'node_modules', packageName);
    const proxyCommandEnv = getProxyCommandEnv();

    runCommand(getNpmBinary(), ['update', packageName, '--prefix', pluginDir], {
        env: proxyCommandEnv
    });

    const pkgPath = path.join(packageRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`package.json not found at: ${pkgPath}`);
    }

    const pkg = readJson(pkgPath);

    if (pkg.version === plugin.version) {
        return {
            status: 'latest',
            version: pkg.version
        };
    }

    updateLegacyRegistryEntry(alias, plugin, pkg, packageRoot);

    return {
        status: 'updated',
        oldVersion: plugin.version,
        newVersion: pkg.version
    };
}

async function performPluginUpdate(alias, plugin, reporter) {
    const officialPlugin = getOfficialPlugin(alias);
    if (officialPlugin) {
        return updateOfficialPlugin(alias, plugin, officialPlugin, reporter);
    }

    return updateLegacyPlugin(alias, plugin);
}

export async function checkSelfUpdate(options = {}) {
    const fetchRegistryVersion = options.registryVersionFetcher || fetchLatestRegistryVersion;
    const currentVersion = options.currentVersion || rootPackage.version;

    try {
        const latestVersion = await Promise.resolve(fetchRegistryVersion(rootPackage.name));
        return createUpdateCheckResult({
            targetId: 'self',
            kind: 'self',
            title: 'SlothTool',
            currentVersion,
            latestVersion,
            status: resolveUpdateStatus(currentVersion, latestVersion),
            sourceLabel: t('sources.npmRegistry')
        });
    } catch (error) {
        return createUpdateCheckResult({
            targetId: 'self',
            kind: 'self',
            title: 'SlothTool',
            currentVersion,
            latestVersion: currentVersion,
            status: 'error',
            sourceLabel: t('sources.npmRegistry'),
            reason: error.message
        });
    }
}

export async function checkPluginUpdate(alias, options = {}) {
    const plugin = options.pluginInfo || registry.getPlugin(alias);

    if (!plugin) {
        throw createCliError(t('uninstall.notInstalled', {alias}));
    }

    const pluginAlias = options.pluginAlias || alias;
    const displayName = options.displayName || pluginAlias;
    const officialPlugin = getOfficialPlugin(pluginAlias);

    try {
        if (officialPlugin) {
            const releaseInfo = await Promise.resolve(
                (options.officialReleaseFetcher || fetchLatestOfficialRelease)(officialPlugin)
            );

            return createUpdateCheckResult({
                targetId: pluginAlias,
                kind: 'plugin',
                title: displayName,
                currentVersion: plugin.version,
                latestVersion: releaseInfo.version,
                status: resolveUpdateStatus(plugin.version, releaseInfo.version, {
                    needsMigration: plugin.sourceType !== 'github-release'
                }),
                sourceLabel: t('sources.githubRelease')
            });
        }

        const latestVersion = await Promise.resolve(
            (options.registryVersionFetcher || fetchLatestRegistryVersion)(getPluginDisplayName(plugin))
        );

        return createUpdateCheckResult({
            targetId: pluginAlias,
            kind: 'plugin',
            title: displayName,
            currentVersion: plugin.version,
            latestVersion,
            status: resolveUpdateStatus(plugin.version, latestVersion),
            sourceLabel: t('sources.npmRegistry')
        });
    } catch (error) {
        return createUpdateCheckResult({
            targetId: pluginAlias,
            kind: 'plugin',
            title: displayName,
            currentVersion: plugin.version,
            latestVersion: plugin.version,
            status: 'error',
            sourceLabel: officialPlugin ? t('sources.githubRelease') : t('sources.npmRegistry'),
            reason: error.message
        });
    }
}

export async function checkAllUpdates(options = {}) {
    const pluginList = options.installedPlugins || listInstalledPlugins();
    const selfChecker = options.selfChecker || checkSelfUpdate;
    const pluginChecker = options.pluginChecker || (plugin =>
        checkPluginUpdate(plugin.alias, {
            ...options,
            pluginInfo: plugin,
            pluginAlias: plugin.alias,
            displayName: plugin.alias
        })
    );

    const self = await Promise.resolve(selfChecker(options));
    const plugins = [];

    for (const plugin of pluginList) {
        plugins.push(await Promise.resolve(pluginChecker(plugin)));
    }

    const items = [self, ...plugins];

    return {
        checkedAt: new Date().toISOString(),
        self,
        plugins,
        items,
        outdatedCount: items.filter(item => item.status === 'outdated').length,
        errorCount: items.filter(item => item.status === 'error').length
    };
}

export function createCliError(message, code = 'SLOTHTOOL_CLI_ERROR') {
    const error = new Error(message);
    error.code = code;
    return error;
}

export function getOfficialPlugins() {
    return officialPlugins.map(plugin => ({...plugin}));
}

export function getOfficialPlugin(alias) {
    return officialPluginMap.get(alias) || null;
}

export function getOfficialPluginAliases() {
    return officialPlugins.map(plugin => plugin.alias);
}

export function isOfficialPlugin(alias) {
    return officialPluginMap.has(alias);
}

export function listInstalledPlugins() {
    return Object.entries(registry.getAllPlugins())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([alias, info]) => ({
            ...info,
            alias,
            displayName: getPluginDisplayName(info),
            sourceLabel: info.sourceType === 'github-release' ? t('sources.githubRelease') : t('sources.npmRegistryLegacy')
        }));
}

export function readInstalledPluginUi(alias) {
    const plugin = registry.getPlugin(alias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: alias}));
    }

    const packageJsonPath = path.join(path.dirname(plugin.binPath), '..', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return {
            cli: true,
            tui: false,
            defaultMode: 'cli',
            tuiFlag: '--tui',
            compatFlags: []
        };
    }

    try {
        const pluginPackage = readJson(packageJsonPath);
        const uiMeta = pluginPackage?.slothtool?.ui;

        if (uiMeta) {
            return {
                cli: uiMeta.cli !== false,
                tui: uiMeta.tui === true,
                defaultMode: uiMeta.defaultMode === 'tui' ? 'tui' : 'cli',
                tuiFlag: uiMeta.tuiFlag || '--tui',
                compatFlags: Array.isArray(uiMeta.compatFlags) ? uiMeta.compatFlags : []
            };
        }

        if (pluginPackage?.slothtool?.interactive) {
            const interactiveFlag = pluginPackage.slothtool.interactiveFlag || '-i';
            return {
                cli: true,
                tui: true,
                defaultMode: 'cli',
                tuiFlag: interactiveFlag,
                compatFlags: [interactiveFlag, '--interactive']
            };
        }
    } catch {
        return {
            cli: true,
            tui: false,
            defaultMode: 'cli',
            tuiFlag: '--tui',
            compatFlags: []
        };
    }

    return {
        cli: true,
        tui: false,
        defaultMode: 'cli',
        tuiFlag: '--tui',
        compatFlags: []
    };
}

export function resolvePluginLaunch(alias, args = [], options = {}) {
    const plugin = registry.getPlugin(alias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: alias}));
    }

    const uiMeta = readInstalledPluginUi(alias);
    const finalArgs = [...args];

    if (options.preferTui && finalArgs.length === 0 && uiMeta.tui && uiMeta.defaultMode !== 'tui') {
        finalArgs.push(uiMeta.tuiFlag || '--tui');
    }

    return {
        plugin,
        uiMeta,
        command: process.execPath,
        args: [plugin.binPath, ...finalArgs]
    };
}

export function runInstalledPlugin(alias, args = [], options = {}) {
    const invocation = resolvePluginLaunch(alias, args, options);

    return new Promise((resolve, reject) => {
        const child = spawn(invocation.command, invocation.args, {
            cwd: options.cwd || process.cwd(),
            stdio: options.stdio || 'inherit',
            env: options.env || process.env
        });

        child.on('error', error => {
            reject(createCliError(t('run.failed', {
                pluginAlias: alias,
                reason: error.message
            })));
        });

        child.on('exit', code => {
            resolve({
                code: code || 0
            });
        });
    });
}

export async function installPlugin(alias, options = {}) {
    const reporter = options.reporter;
    const officialPlugin = getOfficialPlugin(alias);

    if (!officialPlugin) {
        throw createCliError(t('install.officialOnly', {
            aliases: getOfficialPluginAliases().join(', '),
            alias
        }));
    }

    report(reporter, 'info', t('install.start', {alias}));

    if (registry.hasPlugin(alias)) {
        report(reporter, 'warn', t('install.alreadyInstalled', {alias}));
        report(reporter, 'info', t('install.uninstallFirst', {alias}));
        return {status: 'already-installed', alias};
    }

    ensureDir(getPluginsDir());

    try {
        const systemEnvironment = options.systemEnvironment || getSystemEnvironment();
        const releaseFetcher = options.officialReleaseFetcher || fetchLatestOfficialRelease;
        const releaseInstaller = options.officialReleaseInstaller || installOfficialPluginRelease;
        report(reporter, 'info', t('install.targetEnvironment', {
            target: systemEnvironment.target
        }));
        report(reporter, 'info', t('install.checkingUpdates'));
        const releaseInfo = await releaseFetcher(officialPlugin, {systemEnvironment});
        report(reporter, 'info', t('install.installingTo', {dir: getPluginDir(alias)}));
        const entry = await releaseInstaller(alias, officialPlugin, releaseInfo, reporter);
        report(reporter, 'success', t('install.success', {alias}));
        report(reporter, 'info', t('install.runHint', {alias}));
        return {status: 'installed', alias, entry};
    } catch (error) {
        removePath(getPluginDir(alias));
        throw createCliError(t('install.failed', {
            packageName: officialPlugin.packageName,
            reason: error.message
        }));
    }
}

export function uninstallPlugin(alias, options = {}) {
    const reporter = options.reporter;
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        throw createCliError(t('uninstall.notInstalled', {alias}));
    }

    report(reporter, 'info', t('uninstall.start', {alias}));
    report(reporter, 'info', t('uninstall.willRemove'));

    try {
        removePath(getPluginDir(alias));
        removePath(getPluginConfigPath(alias));
        registry.removePlugin(alias);
        report(reporter, 'success', t('uninstall.success', {alias}));
        return {status: 'uninstalled', alias};
    } catch (error) {
        throw createCliError(t('uninstall.failed', {alias, reason: error.message}));
    }
}

export async function updatePlugin(alias, options = {}) {
    const reporter = options.reporter;
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        throw createCliError(t('uninstall.notInstalled', {alias}));
    }

    report(reporter, 'info', t('update.start', {alias}));
    report(reporter, 'info', t('update.currentVersion', {version: plugin.version}));

    try {
        report(reporter, 'info', t('update.checking'));
        const result = await performPluginUpdate(alias, plugin, reporter);

        if (result.status === 'latest') {
            report(reporter, 'success', t('update.latest', {alias, version: result.version}));
            return result;
        }

        if (result.status === 'migrated') {
            report(reporter, 'success', t('update.migrated', {alias, version: result.version}));
            return result;
        }

        report(reporter, 'success', t('update.updated', {
            alias,
            oldVersion: result.oldVersion,
            newVersion: result.newVersion
        }));
        return result;
    } catch (error) {
        throw createCliError(t('update.failed', {alias, reason: error.message}));
    }
}

export async function updateAllPlugins(options = {}) {
    const reporter = options.reporter;
    const plugins = registry.getAllPlugins();
    const aliases = Object.keys(plugins);

    if (aliases.length === 0) {
        return {
            total: 0,
            updated: 0,
            latest: 0,
            failed: 0,
            results: []
        };
    }

    report(reporter, 'info', t('update.allTitle'));
    const summary = {
        total: aliases.length,
        updated: 0,
        latest: 0,
        failed: 0,
        results: []
    };

    for (const alias of aliases) {
        try {
            const result = await updatePlugin(alias, {reporter});
            summary.results.push({alias, ...result});
            if (result.status === 'latest') {
                summary.latest += 1;
            } else {
                summary.updated += 1;
            }
        } catch (error) {
            summary.failed += 1;
            summary.results.push({alias, status: 'failed', reason: error.message});
            report(reporter, 'error', error.message);
        }
    }

    report(reporter, 'info', t('update.allSummary', summary));
    return summary;
}

export function updateSelf(options = {}) {
    const reporter = options.reporter;
    report(reporter, 'info', t('selfUpdate.start'));

    try {
        runCommand(getNpmBinary(), ['install', '-g', '@holic512/slothtool'], {
            env: getProxyCommandEnv()
        });
        report(reporter, 'success', t('selfUpdate.success'));
        return {status: 'updated'};
    } catch (error) {
        throw createCliError(t('selfUpdate.failed', {reason: error.message}));
    }
}

export function describeUninstallAll() {
    const slothtoolDir = getSlothToolHome();
    const plugins = registry.getAllPlugins();
    return {
        slothtoolDir,
        exists: fs.existsSync(slothtoolDir),
        pluginCount: Object.keys(plugins).length
    };
}

export function uninstallAllData(options = {}) {
    const reporter = options.reporter;
    const preview = describeUninstallAll();

    if (!preview.exists) {
        report(reporter, 'info', t('uninstallAll.noData', {dir: preview.slothtoolDir}));
        report(reporter, 'info', t('uninstallAll.alreadyClean'));
        return {
            removed: false,
            ...preview
        };
    }

    try {
        removePath(preview.slothtoolDir);
        report(reporter, 'success', t('uninstallAll.success'));
        report(reporter, 'info', t('uninstallAll.nextStep'));
        return {
            removed: true,
            ...preview
        };
    } catch (error) {
        throw createCliError(t('uninstallAll.failed', {reason: error.message}));
    }
}

export default {
    checkAllUpdates,
    checkPluginUpdate,
    checkSelfUpdate,
    createCliError,
    describeUninstallAll,
    getOfficialPlugin,
    getOfficialPluginAliases,
    getOfficialPlugins,
    installPlugin,
    isOfficialPlugin,
    listInstalledPlugins,
    selectReleaseAssetForEnvironment,
    readInstalledPluginUi,
    resolvePluginLaunch,
    runInstalledPlugin,
    uninstallAllData,
    uninstallPlugin,
    updateAllPlugins,
    updatePlugin,
    updateSelf
};
