/**
 * @file SlothToolPluginService
 * @project SlothTool
 * @module Core CLI / Services
 * @description 管理官方界面插件生命周期，提供统一的数据保留策略与本地受管清理。
 * @logic 校验和安装官方插件归档；仅检查本仓库插件 Release；卸载前预览受管路径并按保留策略清理；验证独立命令位置。
 * @dependencies Node: child_process.spawn/fs/https/os/path, Storage: ../registry.js, Settings: ../settings.js, Network: ./network-helper.js, Data: ../official-plugins.json, I18N: ../i18n.js, System: ./system-environment.js, Vault toolkit Release manifest
 * @index_tags 插件服务, 生命周期, GitHub Release, 离线安装, 离线归档, 平台资产, 代理配置, reporter, CLI底层
 * @author holic512
 */

import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
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
import {cleanupSlothVault, planSlothVaultCleanup} from './slothvault-storage.js';
import {pluginDataPaths, removeOwnedPath} from './plugin-storage.js';
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
const deprecatedPluginAliases = new Map([
    ['slothvault-mcp', 'slothvault']
]);
const shortPluginAliases = new Map([['sv', 'slothvault']]);
const SLOTHVAULT_MULTIFUNCTION_PACKAGE = '@holic512/plugin-slothvault';
const SLOTHVAULT_MAIN_EXECUTABLE = 'slothvault';
const SLOTHVAULT_MCP_EXECUTABLE = 'slothvault-mcp';
const SLOTHVAULT_RUNTIME_META = Object.freeze({
    alias: 'slothvault-runtime', packageName: '@holic512/slothvault-runtime',
    repository: 'holic512/SlothVault', releaseTagPrefix: 'toolkit-v',
    assetNamePrefix: 'holic512-slothvault-runtime-'
});
const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_UPDATE_CHECK_STATUS = 'unchecked';

function report(reporter, level, message, meta = {}) {
    reporter?.({level, message, ...meta});
}

/** Return the catalog alias used for storage, releases, and new user-facing commands. */
export function normalizePluginAlias(alias) {
    return shortPluginAliases.get(alias) || deprecatedPluginAliases.get(alias) || alias;
}

export function isDeprecatedPluginAlias(alias) {
    return deprecatedPluginAliases.has(alias);
}

function reportDeprecatedPluginAlias(alias, reporter) {
    if (isDeprecatedPluginAlias(alias)) {
        report(reporter, 'warn', t('pluginAliases.deprecated', {
            legacy: alias,
            canonical: normalizePluginAlias(alias)
        }));
    }
}

function rebasePluginBinPath(plugin, legacyDirectory, canonicalDirectory, stagedDirectory) {
    const currentPath = String(plugin?.binPath || '');
    const relativePath = path.relative(legacyDirectory, currentPath);
    if (currentPath && relativePath && !relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath)) {
        return path.join(canonicalDirectory, relativePath);
    }

    const packageJsonPath = path.join(stagedDirectory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const pkg = readJson(packageJsonPath);
        return path.join(canonicalDirectory, resolveBinRelativePath(pkg));
    }

    // A registry-only migration can occur in a developer workspace where the
    // recorded bin already belongs to the new package. Prefer its named main
    // executable instead of accidentally retaining the secondary MCP entry.
    const recordedPluginRoot = currentPath ? path.resolve(path.dirname(currentPath), '..') : '';
    const recordedPackagePath = recordedPluginRoot && path.join(recordedPluginRoot, 'package.json');
    if (recordedPackagePath && fs.existsSync(recordedPackagePath)) {
        try {
            return resolveBinPath(recordedPluginRoot, readJson(recordedPackagePath), 'slothvault');
        } catch {
            // A missing legacy package cannot be made runnable without an installed directory.
        }
    }
    return currentPath;
}

/** Return a writable command path only when root dispatch can verify its bin is the active command bin. */
function resolveVerifiedSlothToolCommandPath(options = {}) {
    const requestedPath = String(options.slothtoolCommandPath || process.argv[1] || '').trim();
    if (!requestedPath) {
        return '';
    }

    const commandPath = path.resolve(requestedPath);
    const binDirectory = path.dirname(commandPath);
    const sourceRoot = path.resolve(binDirectory, '..');
    if (!fs.existsSync(commandPath) || fs.existsSync(path.join(sourceRoot, '.git'))) {
        return '';
    }

    const pathEntries = String(process.env.PATH || '')
        .split(path.delimiter)
        .filter(Boolean)
        .map(entry => path.resolve(entry));
    return pathEntries.includes(binDirectory) ? commandPath : '';
}

/**
 * Migrate the former SlothVault MCP plugin identity without overwriting a canonical install.
 * The directory is staged by rename, the registry is atomically replaced, and a failed final
 * rename restores the original registry and directory before reporting the error.
 */
export function migrateSlothvaultPluginAlias() {
    const legacyAlias = 'slothvault-mcp';
    const canonicalAlias = 'slothvault';
    const legacyDirectory = getPluginDir(legacyAlias);
    const canonicalDirectory = getPluginDir(canonicalAlias);
    const originalRegistry = registry.readRegistry();
    const legacyPlugin = originalRegistry.plugins[legacyAlias];
    const canonicalPlugin = originalRegistry.plugins[canonicalAlias];
    const result = {
        alias: canonicalAlias,
        plugin: 'absent'
    };

    if (legacyPlugin || fs.existsSync(legacyDirectory)) {
        if (canonicalPlugin || fs.existsSync(canonicalDirectory)) {
            result.plugin = 'conflict';
        } else {
            ensureDir(getPluginsDir());
            const stagedDirectory = path.join(getPluginsDir(), `.${canonicalAlias}.migration.${process.pid}.${Date.now()}`);
            let registryUpdated = false;
            try {
                if (fs.existsSync(legacyDirectory)) {
                    const stats = fs.lstatSync(legacyDirectory);
                    if (!stats.isDirectory() || stats.isSymbolicLink()) {
                        throw new Error(`Legacy SlothVault plugin path is not a directory: ${legacyDirectory}`);
                    }
                    fs.renameSync(legacyDirectory, stagedDirectory);
                }

                if (legacyPlugin) {
                    const nextRegistry = JSON.parse(JSON.stringify(originalRegistry));
                    nextRegistry.plugins[canonicalAlias] = {
                        ...legacyPlugin,
                        name: SLOTHVAULT_MULTIFUNCTION_PACKAGE,
                        packageName: SLOTHVAULT_MULTIFUNCTION_PACKAGE,
                        binPath: rebasePluginBinPath(legacyPlugin, legacyDirectory, canonicalDirectory, stagedDirectory)
                    };
                    delete nextRegistry.plugins[legacyAlias];
                    registry.writeRegistry(nextRegistry);
                    registryUpdated = true;
                }

                if (fs.existsSync(stagedDirectory)) {
                    fs.renameSync(stagedDirectory, canonicalDirectory);
                }
                result.plugin = legacyPlugin || fs.existsSync(canonicalDirectory) ? 'migrated' : 'absent';
            } catch (error) {
                if (registryUpdated) {
                    try {
                        registry.writeRegistry(originalRegistry);
                    } catch {
                        // The original migration error remains the actionable failure.
                    }
                }
                if (fs.existsSync(stagedDirectory) && !fs.existsSync(legacyDirectory)) {
                    try {
                        fs.renameSync(stagedDirectory, legacyDirectory);
                    } catch {
                        // Keep the original failure; no destructive cleanup is attempted.
                    }
                }
                throw createCliError(`Unable to migrate the legacy SlothVault plugin: ${error.message}`, 'SLOTHVAULT_ALIAS_MIGRATION_FAILED');
            }
        }
    }

    return result;
}

function preparePluginAlias(alias, reporter) {
    const canonicalAlias = normalizePluginAlias(alias);
    if (canonicalAlias === 'slothvault') {
        const migration = migrateSlothvaultPluginAlias();
        if (migration.plugin === 'conflict') {
            report(reporter, 'warn', t('pluginAliases.migrationConflict'));
            throw createCliError(t('pluginAliases.migrationConflict'), 'SLOTHVAULT_ALIAS_MIGRATION_CONFLICT');
        }
    }
    reportDeprecatedPluginAlias(alias, reporter);
    return canonicalAlias;
}

/**
 * Inspect the installed SlothVault package shape without reading its local MCP data.
 * A renamed v1 MCP-only directory must never be launched as the v2 multifunction package:
 * it would look for the former configuration path and make a valid default profile appear lost.
 */
function inspectSlothvaultRuntime(plugin) {
    const packageJsonPath = path.join(path.dirname(plugin.binPath), '..', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return {state: 'missing-package', packageJsonPath};
    }

    try {
        const packageJson = readJson(packageJsonPath);
        const bin = packageJson.bin;
        const hasRequiredExecutables = Boolean(
            bin
            && typeof bin === 'object'
            && typeof bin[SLOTHVAULT_MAIN_EXECUTABLE] === 'string'
            && typeof bin[SLOTHVAULT_MCP_EXECUTABLE] === 'string'
        );
        return {
            state: packageJson.name === SLOTHVAULT_MULTIFUNCTION_PACKAGE && hasRequiredExecutables
                ? 'current'
                : 'legacy',
            packageJsonPath,
            packageName: String(packageJson.name || ''),
            version: String(packageJson.version || '')
        };
    } catch {
        return {state: 'invalid-package', packageJsonPath};
    }
}

/** Reject old MCP-only package code before it can read or recreate a legacy profile path. */
function assertCurrentSlothvaultRuntime(plugin) {
    const runtime = inspectSlothvaultRuntime(plugin);
    if (runtime.state === 'current') {
        return;
    }
    throw createCliError(t('pluginAliases.upgradeRequired'), 'SLOTHVAULT_PLUGIN_UPGRADE_REQUIRED');
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

export function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
        let stdout = '';
        let stderr = '';
        let outputSize = 0;
        let settled = false;

        const child = spawn(command, args, {
            cwd: options.cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                ...options.env
            }
        });

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            reject(error);
        }

        function appendOutput(target, chunk) {
            const text = chunk.toString('utf8');
            outputSize += Buffer.byteLength(text);

            if (outputSize > maxBuffer) {
                child.kill();
                fail(new Error(`Command output exceeded ${maxBuffer} bytes: ${command}`));
                return target;
            }

            return target + text;
        }

        child.stdout.on('data', chunk => {
            stdout = appendOutput(stdout, chunk);
        });
        child.stderr.on('data', chunk => {
            stderr = appendOutput(stderr, chunk);
        });
        child.on('error', fail);
        child.on('close', code => {
            if (settled) {
                return;
            }

            settled = true;

            if (code === 0) {
                resolve(stdout);
                return;
            }

            const reason = stderr.trim() || stdout.trim() || `Command failed with exit code ${code}: ${command}`;
            reject(new Error(reason));
        });
    });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveBinRelativePath(pkg, binName = '') {
    if (typeof pkg.bin === 'string') {
        if (binName && binName !== pkg.name) {
            throw new Error(`No bin named "${binName}" found in package.json for ${pkg.name}.`);
        }
        return pkg.bin;
    }

    if (pkg.bin && typeof pkg.bin === 'object') {
        const binKey = binName || Object.keys(pkg.bin)[0];
        if (!binKey || typeof pkg.bin[binKey] !== 'string') {
            throw new Error(`No bin named "${binName}" found in package.json for ${pkg.name}.`);
        }
        return pkg.bin[binKey];
    }

    throw new Error(`No bin field found in package.json for ${pkg.name}.`);
}

function resolveBinPath(installRoot, pkg, binName = '') {
    const binPath = path.join(installRoot, resolveBinRelativePath(pkg, binName));

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

function archiveListingLines(output) {
    const lines = output.split(/\r?\n/u);
    if (lines.at(-1) === '') {
        lines.pop();
    }
    return lines;
}

function assertSafeArchiveMemberName(memberName) {
    const normalized = memberName.replaceAll('\\', '/');
    const isAbsolute = normalized.startsWith('/')
        || normalized.startsWith('//')
        || /^[A-Za-z]:\//u.test(normalized);
    const segments = normalized.split('/').filter(segment => segment && segment !== '.');

    if (!memberName || memberName.includes('\0') || memberName.includes('\r') || memberName.includes('\n') || isAbsolute || segments.includes('..')) {
        throw new Error(t('install.archiveUnsafePath', {entry: memberName || '-'}));
    }
}

function assertSafeExtractedTree(rootDir) {
    for (const entry of fs.readdirSync(rootDir, {withFileTypes: true})) {
        const entryPath = path.join(rootDir, entry.name);
        const stats = fs.lstatSync(entryPath);

        if (entry.isDirectory()) {
            assertSafeExtractedTree(entryPath);
            continue;
        }

        if (!entry.isFile() || stats.isSymbolicLink()) {
            throw new Error(t('install.archiveUnsupportedEntry', {
                entry: path.relative(rootDir, entryPath) || entry.name,
                type: stats.isSymbolicLink() ? 'link' : 'special'
            }));
        }
    }
}

export async function extractTarballSafely(archivePath, extractDir) {
    const [nameOutput, verboseOutput] = await Promise.all([
        runCommand('tar', ['-tzf', archivePath], {maxBuffer: 64 * 1024 * 1024}),
        runCommand('tar', ['-tvzf', archivePath], {maxBuffer: 64 * 1024 * 1024})
    ]);
    const memberNames = archiveListingLines(nameOutput);
    const verboseEntries = archiveListingLines(verboseOutput);

    if (!memberNames.length) {
        throw new Error(t('install.archiveEmpty'));
    }
    if (memberNames.length !== verboseEntries.length) {
        throw new Error(t('install.archiveListingMismatch'));
    }

    for (let index = 0; index < memberNames.length; index += 1) {
        const memberName = memberNames[index];
        const entryType = verboseEntries[index][0] || '?';
        assertSafeArchiveMemberName(memberName);
        if (entryType !== '-' && entryType !== 'd') {
            throw new Error(t('install.archiveUnsupportedEntry', {
                entry: memberName,
                type: entryType
            }));
        }
    }

    await runCommand('tar', ['-xzf', archivePath, '-C', extractDir]);
    assertSafeExtractedTree(extractDir);
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

async function fetchLatestRegistryVersion(packageName) {
    const version = await runCommand(getNpmBinary(), ['view', packageName, 'version'], {
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

export function githubRequestJson(url, currentSettings = getNetworkSettingsSnapshot()) {
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

export function downloadFile(url, targetPath, redirectCount = 0, currentSettings = getNetworkSettingsSnapshot()) {
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

export async function fetchLatestOfficialRelease(pluginMeta, options = {}) {
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

export function resolveExtractedPackageRoot(extractDir, assetName = 'release asset') {
    const directPackageJsonPath = path.join(extractDir, 'package.json');
    if (fs.existsSync(directPackageJsonPath)) {
        return extractDir;
    }

    const npmPackRoot = path.join(extractDir, 'package');
    if (fs.existsSync(path.join(npmPackRoot, 'package.json'))) {
        return npmPackRoot;
    }

    const candidateDirectories = fs.readdirSync(extractDir, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(extractDir, entry.name))
        .filter(candidatePath => fs.existsSync(path.join(candidatePath, 'package.json')));

    if (candidateDirectories.length === 1) {
        return candidateDirectories[0];
    }

    if (candidateDirectories.length > 1) {
        throw new Error(`Multiple package roots found in release asset: ${assetName}`);
    }

    throw new Error(`package.json not found in release asset: ${assetName}`);
}

async function stageOfficialPluginRelease(pluginMeta, releaseInfo, reporter, expectedSha256 = null) {
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
        if (expectedSha256) {
            const actualSha256 = createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex');
            if (actualSha256 !== expectedSha256) throw new Error('SlothVault runtime archive checksum mismatch.');
        }

        await extractTarballSafely(tarballPath, extractDir);

        const packageRoot = resolveExtractedPackageRoot(extractDir, releaseInfo.asset.name);

        copyDirectoryContents(packageRoot, buildDir);
        if (pluginMeta.alias === SLOTHVAULT_RUNTIME_META.alias && !fs.existsSync(path.join(buildDir, 'npm-shrinkwrap.json'))) {
            throw new Error('Vault toolkit package is missing its locked dependencies.');
        }
        report(reporter, 'info', t('install.installingDependencies'));
        await runCommand(getNpmBinary(), [fs.existsSync(path.join(buildDir, 'npm-shrinkwrap.json')) ? 'ci' : 'install', '--omit=dev',
            ...(pluginMeta.alias === SLOTHVAULT_RUNTIME_META.alias ? ['--ignore-scripts'] : [])], {
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

async function stageOfflinePluginArchive(archivePath, reporter) {
    const resolvedArchivePath = path.resolve(archivePath);
    if (!fs.existsSync(resolvedArchivePath)) {
        throw new Error(t('install.offlineArchiveMissing', {path: resolvedArchivePath}));
    }
    if (!resolvedArchivePath.endsWith('.tgz')) {
        throw new Error(t('install.offlineArchiveType', {path: resolvedArchivePath}));
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-offline-plugin-'));
    const extractDir = path.join(tempRoot, 'extract');
    const buildDir = path.join(tempRoot, 'build');
    ensureDir(extractDir);
    ensureDir(buildDir);

    try {
        report(reporter, 'info', t('install.usingOfflineArchive', {name: path.basename(resolvedArchivePath)}));
        await extractTarballSafely(resolvedArchivePath, extractDir);
        const packageRoot = resolveExtractedPackageRoot(extractDir, path.basename(resolvedArchivePath));
        copyDirectoryContents(packageRoot, buildDir);

        const pkg = readJson(path.join(buildDir, 'package.json'));
        const dependencies = Object.keys(pkg.dependencies || {});
        if (dependencies.length > 0 && !fs.existsSync(path.join(buildDir, 'node_modules'))) {
            report(reporter, 'info', t('install.offlineCacheOnly'));
            try {
                await runCommand(getNpmBinary(), ['install', '--omit=dev', '--offline'], {
                    cwd: buildDir,
                    env: getProxyCommandEnv()
                });
            } catch (error) {
                throw new Error(t('install.offlineDependenciesMissing', {reason: error.message}));
            }
        }

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

async function installOfflinePluginArchive(alias, pluginMeta, archivePath, reporter, existingPlugin = null) {
    const staged = await stageOfflinePluginArchive(archivePath, reporter);

    try {
        if (staged.packageJson.name !== pluginMeta.packageName) {
            throw new Error(t('install.offlinePackageMismatch', {
                actual: staged.packageJson.name || '-',
                expected: pluginMeta.packageName
            }));
        }
        const pluginDir = deployStagedPlugin(alias, staged.stagedDir);
        const now = new Date().toISOString();
        const registryEntry = {
            name: pluginMeta.packageName,
            packageName: pluginMeta.packageName,
            version: staged.packageJson.version,
            binPath: path.join(pluginDir, staged.binRelativePath),
            installedAt: existingPlugin ? existingPlugin.installedAt : now,
            ...(existingPlugin?.lastRunAt ? {lastRunAt: existingPlugin.lastRunAt} : {}),
            sourceType: 'offline-archive',
            assetName: path.basename(archivePath),
            installTarget: 'generic'
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
            ...(existingPlugin?.lastRunAt ? {lastRunAt: existingPlugin.lastRunAt} : {}),
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

/** Resolve the Vault-owned runtime independently of the SlothTool UI plugin release. */
export function getSlothVaultRuntimePaths(options = {}) {
    const root = path.join(options.slothToolHome || getSlothToolHome(), 'runtimes', 'slothvault');
    return {root, releases: path.join(root, 'releases'), current: path.join(root, 'current')};
}

function installedRuntimeVersion(paths) {
    try {
        const pkg = readJson(path.join(paths.current, 'package.json'));
        return pkg.name === SLOTHVAULT_RUNTIME_META.packageName ? pkg.version : null;
    } catch { return null; }
}

export async function fetchLatestSlothVaultRuntime(options = {}) {
    const releaseInfo = await (options.releaseFetcher || fetchLatestOfficialRelease)(SLOTHVAULT_RUNTIME_META);
    const asset = releaseInfo.release?.assets?.find(item => item.name === 'slothvault-toolkit.json');
    if (!asset) throw new Error('Vault toolkit release manifest is missing.');
    const manifest = await (options.manifestFetcher || githubRequestJson)(asset.browser_download_url);
    if (manifest?.schema !== 1 || manifest.packageName !== SLOTHVAULT_RUNTIME_META.packageName ||
        manifest.version !== releaseInfo.version || manifest.asset !== releaseInfo.asset.name ||
        manifest.adapterApiMajor !== 1 || !/^[a-f0-9]{64}$/u.test(manifest.sha256 || '') ||
        !/^\d+\.\d+\.\d+$/u.test(manifest.skillVersion || '')) {
        throw new Error('Vault toolkit release manifest is invalid or incompatible.');
    }
    return {...releaseInfo, manifest};
}

export async function checkSlothVaultRuntimeUpdate(options = {}) {
    const release = await fetchLatestSlothVaultRuntime(options);
    const currentVersion = installedRuntimeVersion(getSlothVaultRuntimePaths(options));
    return {currentVersion, latestVersion: release.version, latestSkillVersion: release.manifest.skillVersion,
        status: currentVersion === release.version ? 'latest' : 'outdated', release};
}

function verifyRuntimePackage(root, release) {
    const pkg = readJson(path.join(root, 'package.json'));
    const contract = readJson(path.join(root, 'runtime-contract.json'));
    const skill = readJson(path.join(root, 'skill-release.json'));
    if (pkg.name !== SLOTHVAULT_RUNTIME_META.packageName || pkg.version !== release.version ||
        contract.schema !== 1 || contract.adapterApiMajor !== 1 ||
        skill.pluginVersion !== pkg.version || skill.skillVersion !== release.manifest.skillVersion ||
        !fs.existsSync(path.join(root, 'bin', 'slothvault-mcp.js')) ||
        !fs.existsSync(path.join(root, 'bin', 'slothvault-runtime.js')) ||
        !fs.existsSync(path.join(root, 'deploy', 'install.py'))) {
        throw new Error('Vault toolkit package contract is invalid.');
    }
    for (const [relative, digest] of Object.entries(skill.files || {})) {
        const file = path.resolve(root, 'skills', 'slothvault-mcp', relative);
        if (!file.startsWith(path.resolve(root, 'skills', 'slothvault-mcp') + path.sep) ||
            !fs.statSync(file).isFile() || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== digest) {
            throw new Error(`Vault toolkit Skill file failed validation: ${relative}`);
        }
    }
    if (!skill.files?.['SKILL.md']) throw new Error('Vault toolkit Skill is missing.');
    return pkg;
}

function replaceRuntimeLink(nextLink, currentLink) {
    if (process.platform !== 'win32' || !fs.existsSync(currentLink)) {
        fs.renameSync(nextLink, currentLink);
        return;
    }
    const backup = `${currentLink}.backup-${process.pid}-${Date.now()}`;
    fs.renameSync(currentLink, backup);
    try {
        fs.renameSync(nextLink, currentLink);
        removePath(backup);
    } catch (error) {
        fs.renameSync(backup, currentLink);
        throw error;
    }
}

/** Stage and validate the whole runtime before switching one stable current pointer. */
export async function installSlothVaultRuntime(options = {}) {
    const paths = getSlothVaultRuntimePaths(options);
    const release = options.release || await fetchLatestSlothVaultRuntime(options);
    if (installedRuntimeVersion(paths) === release.version) return {status: 'latest', version: release.version, skillVersion: release.manifest.skillVersion};
    const staged = await (options.stageRelease || stageOfficialPluginRelease)(SLOTHVAULT_RUNTIME_META, release, options.reporter, release.manifest.sha256);
    let prepared = '';
    let skillConflicts = [];
    const previous = fs.existsSync(paths.current) ? fs.readlinkSync(paths.current) : null;
    try {
        verifyRuntimePackage(staged.stagedDir, release);
        ensureDir(paths.releases);
        prepared = fs.mkdtempSync(path.join(paths.root, '.stage-'));
        copyDirectoryContents(staged.stagedDir, prepared);
        verifyRuntimePackage(prepared, release);
        const target = path.join(paths.releases, release.version);
        if (!fs.existsSync(target)) fs.renameSync(prepared, target);
        else verifyRuntimePackage(target, release);
        prepared = '';
        const link = path.join(paths.root, `.current-${process.pid}-${Date.now()}`);
        fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
        try { replaceRuntimeLink(link, paths.current); }
        catch (error) { removePath(link); throw error; }
        try {
            const skillResult = await (options.syncSkill || runCommand)(process.execPath,
                [path.join(paths.current, 'bin', 'slothvault-runtime.js'), 'skill', 'install', '--json'],
                {maxBuffer: 4 * 1024 * 1024});
            const parsed = JSON.parse(skillResult);
            if (parsed.ok === false) throw new Error(parsed.error?.message || 'Skill synchronization failed.');
            skillConflicts = (parsed.agents || []).filter(agent => agent.state === 'conflict').map(agent => agent.targetPath);
            if (skillConflicts.length) report(options.reporter, 'warn', t('install.skillConflictsPreserved', {targets: skillConflicts.join(', ')}));
        } catch (error) {
            let runtimeError;
            try { runtimeError = JSON.parse(error.message); } catch { /* Keep the original failure below. */ }
            if (runtimeError?.error?.code !== 'SKILL_AGENT_NOT_DETECTED') {
                if (previous) {
                    const rollback = path.join(paths.root, `.rollback-${process.pid}`);
                    fs.symlinkSync(previous, rollback, process.platform === 'win32' ? 'junction' : 'dir');
                    replaceRuntimeLink(rollback, paths.current);
                } else fs.unlinkSync(paths.current);
                throw error;
            }
        }
        return {status: 'updated', version: release.version, skillVersion: release.manifest.skillVersion, skillConflicts};
    } finally {
        if (prepared) removePath(prepared);
        if (staged.tempRoot) removePath(staged.tempRoot);
    }
}

export function uninstallSlothVaultRuntime(options = {}) {
    const paths = getSlothVaultRuntimePaths(options);
    const control = path.join(paths.current, 'bin', 'slothvault-runtime.js');
    if (fs.existsSync(control)) {
        const skill = spawnSync(process.execPath, [control, 'skill', 'uninstall', '--skip-conflicts', '--json'],
            {encoding: 'utf8', env: process.env});
        if (skill.error || skill.status !== 0) throw new Error('Unable to remove managed SlothVault Skill links.');
        const commandPath = resolveVerifiedSlothToolCommandPath(options);
        if (commandPath) {
            const command = spawnSync(process.execPath, [control, 'mcp', 'unregister', '--json'], {
                encoding: 'utf8', env: {...process.env, SLOTHTOOL_COMMAND_PATH: commandPath, SLOTHTOOL_COMMAND_PATH_VERIFIED: '1'}
            });
            if (command.error) throw command.error;
            if (command.status !== 0) {
                let response;
                try { response = JSON.parse(command.stdout); } catch { /* Use the general failure below. */ }
                // A custom command target is deliberately left untouched.
                if (response?.error?.code !== 'MCP_COMMAND_UNMANAGED_TARGET') {
                    throw new Error(response?.error?.message || 'Unable to remove the managed SlothVault MCP command.');
                }
            }
        }
    }
    removePath(paths.root);
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

async function updateLegacyPlugin(alias, plugin) {
    const pluginDir = getPluginDir(alias);
    const packageName = getPluginDisplayName(plugin);
    const packageRoot = path.join(pluginDir, 'node_modules', packageName);
    const proxyCommandEnv = getProxyCommandEnv();

    await runCommand(getNpmBinary(), ['update', packageName, '--prefix', pluginDir], {
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
    const canonicalAlias = normalizePluginAlias(alias);
    const plugin = options.pluginInfo || registry.getPlugin(canonicalAlias);

    if (!plugin) {
        throw createCliError(t('uninstall.notInstalled', {alias: canonicalAlias}));
    }

    const pluginAlias = normalizePluginAlias(options.pluginAlias || canonicalAlias);
    const displayName = options.displayName || pluginAlias;
    const officialPlugin = getOfficialPlugin(pluginAlias);

    try {
        if (officialPlugin) {
            const releaseInfo = await Promise.resolve(
                (options.officialReleaseFetcher || fetchLatestOfficialRelease)(officialPlugin)
            );

            const adapterCheck = createUpdateCheckResult({
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
            return adapterCheck;
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
    return officialPluginMap.get(normalizePluginAlias(alias)) || null;
}

export function getOfficialPluginAliases() {
    return officialPlugins.map(plugin => plugin.alias);
}

export function isOfficialPlugin(alias) {
    return officialPluginMap.has(normalizePluginAlias(alias));
}

export function listInstalledPlugins() {
    const migration = migrateSlothvaultPluginAlias();
    if (migration.plugin === 'conflict') {
        throw createCliError(t('pluginAliases.migrationConflict'), 'SLOTHVAULT_ALIAS_MIGRATION_CONFLICT');
    }
    return Object.entries(registry.getAllPlugins())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([alias, info]) => ({
            ...info,
            alias,
            displayName: getPluginDisplayName(info),
            sourceLabel: info.sourceType === 'github-release'
                ? t('sources.githubRelease')
                : (info.sourceType === 'offline-archive' ? t('sources.offlineArchive') : t('sources.npmRegistryLegacy'))
        }));
}

export function readInstalledPluginUi(alias) {
    const canonicalAlias = preparePluginAlias(alias);
    const plugin = registry.getPlugin(canonicalAlias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: canonicalAlias}));
    }

    if (canonicalAlias === 'slothvault') {
        assertCurrentSlothvaultRuntime(plugin);
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
    const canonicalAlias = preparePluginAlias(alias, options.reporter);
    const isLegacyMcpInvocation = isDeprecatedPluginAlias(alias);
    const isLegacySkillInvocation = isLegacyMcpInvocation && args[0] === 'skill';
    const plugin = registry.getPlugin(canonicalAlias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: canonicalAlias}));
    }

    const uiMeta = readInstalledPluginUi(canonicalAlias);
    const finalArgs = [...args];

    if (options.preferTui && finalArgs.length === 0 && uiMeta.tui && uiMeta.defaultMode !== 'tui') {
        finalArgs.push(uiMeta.tuiFlag || '--tui');
    }

    let binPath = plugin.binPath;
    if (isLegacyMcpInvocation) {
        const pluginRoot = path.resolve(path.dirname(plugin.binPath), '..');
        const packageJsonPath = path.join(pluginRoot, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            throw createCliError(`Plugin package.json not found at: ${packageJsonPath}`);
        }
        binPath = resolveBinPath(pluginRoot, readJson(packageJsonPath), isLegacySkillInvocation ? 'slothvault' : 'slothvault-mcp');
    }

    return {
        plugin,
        alias: canonicalAlias,
        requestedAlias: alias,
        deprecatedAlias: isLegacyMcpInvocation,
        uiMeta,
        command: process.execPath,
        args: [binPath, ...finalArgs]
    };
}

export function recordPluginRun(alias) {
    const canonicalAlias = normalizePluginAlias(alias);
    const plugin = registry.getPlugin(canonicalAlias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: canonicalAlias}));
    }

    const lastRunAt = new Date().toISOString();
    registry.addPlugin(canonicalAlias, {
        ...plugin,
        lastRunAt
    });
    return lastRunAt;
}

export function runInstalledPlugin(alias, args = [], options = {}) {
    const invocation = resolvePluginLaunch(alias, args, options);
    const slothtoolCommandPath = invocation.alias === 'slothvault'
        ? resolveVerifiedSlothToolCommandPath(options)
        : '';

    return new Promise((resolve, reject) => {
        let lastRunAt = null;
        const child = spawn(invocation.command, invocation.args, {
            cwd: options.cwd || process.cwd(),
            stdio: options.stdio || 'inherit',
            env: {
                ...process.env,
                ...(options.env || {}),
                ...(slothtoolCommandPath
                    ? {
                        SLOTHTOOL_COMMAND_PATH: slothtoolCommandPath,
                        SLOTHTOOL_COMMAND_PATH_VERIFIED: '1',
                        SLOTHTOOL_ENTRY_PATH: fileURLToPath(new URL('../../bin/slothtool.js', import.meta.url))
                    }
                    : {
                        SLOTHTOOL_COMMAND_PATH: '',
                        SLOTHTOOL_COMMAND_PATH_VERIFIED: '',
                        SLOTHTOOL_ENTRY_PATH: ''
                    })
            }
        });

        child.on('spawn', () => {
            try {
                lastRunAt = recordPluginRun(invocation.alias);
            } catch {
                lastRunAt = null;
            }
        });

        child.on('error', error => {
            reject(createCliError(t('run.failed', {
                pluginAlias: invocation.alias,
                reason: error.message
            })));
        });

        child.on('exit', code => {
            resolve({
                code: code || 0,
                lastRunAt
            });
        });
    });
}

export async function installPluginFromArchive(alias, archivePath, options = {}) {
    const reporter = options.reporter;
    const canonicalAlias = preparePluginAlias(alias, reporter);
    const officialPlugin = getOfficialPlugin(canonicalAlias);
    if (!officialPlugin) {
        throw createCliError(t('install.officialOnly', {
            aliases: getOfficialPluginAliases().join(', '),
            alias
        }));
    }
    if (!archivePath) {
        throw createCliError(t('install.offlineArchiveRequired'));
    }

    report(reporter, 'info', t('install.start', {alias}));
    if (registry.hasPlugin(canonicalAlias)) {
        report(reporter, 'warn', t('install.alreadyInstalled', {alias: canonicalAlias}));
        report(reporter, 'info', t('install.uninstallFirst', {alias: canonicalAlias}));
        return {status: 'already-installed', alias: canonicalAlias};
    }

    ensureDir(getPluginsDir());
    try {
        report(reporter, 'info', t('install.installingTo', {dir: getPluginDir(canonicalAlias)}));
        const installer = options.offlineArchiveInstaller || installOfflinePluginArchive;
        const entry = await installer(canonicalAlias, officialPlugin, archivePath, reporter);
        report(reporter, 'success', t('install.success', {alias: canonicalAlias}));
        report(reporter, 'info', t('install.runHint', {alias: canonicalAlias}));
        return {status: 'installed', alias: canonicalAlias, plugin: entry, sourceType: 'offline-archive'};
    } catch (error) {
        if (canonicalAlias === 'slothvault') {
            removePath(getPluginDir(canonicalAlias));
            registry.removePlugin(canonicalAlias);
        }
        const packageName = officialPlugin.packageName || alias;
        throw createCliError(t('install.failed', {packageName, reason: error.message}));
    }
}

export async function createOfflinePluginBundle(alias, outputPath, options = {}) {
    const canonicalAlias = preparePluginAlias(alias, options.reporter);
    const officialPlugin = getOfficialPlugin(canonicalAlias);
    if (!officialPlugin) {
        throw createCliError(t('install.officialOnly', {
            aliases: getOfficialPluginAliases().join(', '),
            alias
        }));
    }
    const plugin = registry.getPlugin(canonicalAlias);
    if (!plugin) {
        throw createCliError(t('run.pluginNotFound', {pluginAlias: canonicalAlias}));
    }

    const pluginRoot = getPluginDir(canonicalAlias);
    const packageJsonPath = path.join(pluginRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw createCliError(t('bundle.packageMissing', {path: packageJsonPath}));
    }

    const pkg = readJson(packageJsonPath);
    if (pkg.name !== officialPlugin.packageName) {
        throw createCliError(t('install.offlinePackageMismatch', {
            actual: pkg.name || '-',
            expected: officialPlugin.packageName
        }));
    }
    const dependencies = Object.keys(pkg.dependencies || {});
    if (dependencies.length > 0 && !fs.existsSync(path.join(pluginRoot, 'node_modules'))) {
        throw createCliError(t('bundle.dependenciesMissing', {alias: canonicalAlias}));
    }

    const defaultName = `${canonicalAlias}-${pkg.version || 'bundle'}-offline.tgz`;
    const destination = path.resolve(outputPath || path.join(process.cwd(), defaultName));
    if (fs.existsSync(destination)) {
        throw createCliError(t('bundle.alreadyExists', {path: destination}));
    }
    ensureDir(path.dirname(destination));

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-offline-bundle-'));
    try {
        const packageDir = path.join(tempRoot, 'package');
        copyDirectoryContents(pluginRoot, packageDir);
        await runCommand('tar', ['-czf', destination, '-C', tempRoot, 'package']);
        return {alias: canonicalAlias, outputPath: destination, packageName: pkg.name, version: pkg.version};
    } finally {
        removePath(tempRoot);
    }
}

export async function installPlugin(alias, options = {}) {
    const reporter = options.reporter;
    const canonicalAlias = preparePluginAlias(alias, reporter);
    const officialPlugin = getOfficialPlugin(canonicalAlias);

    if (!officialPlugin) {
        throw createCliError(t('install.officialOnly', {
            aliases: getOfficialPluginAliases().join(', '),
            alias
        }));
    }

    report(reporter, 'info', t('install.start', {alias: canonicalAlias}));

    if (registry.hasPlugin(canonicalAlias)) {
        report(reporter, 'warn', t('install.alreadyInstalled', {alias: canonicalAlias}));
        report(reporter, 'info', t('install.uninstallFirst', {alias: canonicalAlias}));
        return {status: 'already-installed', alias: canonicalAlias};
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
        report(reporter, 'info', t('install.installingTo', {dir: getPluginDir(canonicalAlias)}));
        const entry = await releaseInstaller(canonicalAlias, officialPlugin, releaseInfo, reporter);
        report(reporter, 'success', t('install.success', {alias: canonicalAlias}));
        report(reporter, 'info', t('install.runHint', {alias: canonicalAlias}));
        return {status: 'installed', alias: canonicalAlias, entry};
    } catch (error) {
        removePath(getPluginDir(canonicalAlias));
        if (canonicalAlias === 'slothvault') registry.removePlugin(canonicalAlias);
        throw createCliError(t('install.failed', {
            packageName: officialPlugin.packageName,
            reason: error.message
        }));
    }
}

export function describePluginUninstall(alias, options = {}) {
    const canonicalAlias = normalizePluginAlias(alias);
    const dataPolicy = options.dataPolicy || 'keep';
    if (!['keep', 'purge'].includes(dataPolicy)) throw createCliError('Invalid uninstall data policy.');
    const plugin = registry.getPlugin(canonicalAlias) || registry.getPlugin(alias);
    if (!plugin) throw createCliError(t('uninstall.notInstalled', {alias: canonicalAlias}));
    const vault = canonicalAlias === 'slothvault' ? planSlothVaultCleanup({...options, uninstall: true, purgeData: dataPolicy === 'purge', slothtoolExecutable: resolveVerifiedSlothToolCommandPath(options)}) : null;
    const programPaths = [...new Set([getPluginDir(canonicalAlias), ...(alias === 'slothvault-mcp' ? [getPluginDir(alias)] : [])])], dataPaths = pluginDataPaths(canonicalAlias);
    return {alias: canonicalAlias, dataPolicy, programPaths, dataPaths, vault,
        paths: [...new Set([...programPaths, ...(vault?.items || []).map(item => item.path), ...(dataPolicy === 'purge' ? dataPaths : [])])]};
}

export function uninstallPlugin(alias, options = {}) {
    const reporter = options.reporter;
    const canonicalAlias = preparePluginAlias(alias, reporter);
    const preview = describePluginUninstall(canonicalAlias, options);
    const removed = [], errors = [];
    report(reporter, 'info', t('uninstall.start', {alias: canonicalAlias}));
    if (canonicalAlias === 'slothvault') {
        const result = cleanupSlothVault({...options, uninstall: true, purgeData: preview.dataPolicy === 'purge', slothtoolExecutable: resolveVerifiedSlothToolCommandPath(options)});
        removed.push(...result.removed.map(item => item.path));
        errors.push(...result.errors);
    }
    if (preview.dataPolicy === 'purge') for (const file of preview.dataPaths) {
        try {if (removeOwnedPath(file, getSlothToolHome())) removed.push(file);}
        catch (error) {errors.push({path: file, code: error.code || 'CLEANUP_FAILED'});}
    }
    if (!errors.length) {
        try {if (removeOwnedPath(getPluginDir(canonicalAlias), getSlothToolHome())) removed.push(getPluginDir(canonicalAlias));}
        catch (error) {errors.push({path: getPluginDir(canonicalAlias), code: error.code || 'CLEANUP_FAILED'});}
    }
    if (errors.length) {
        for (const file of removed) report(reporter, 'info', t('uninstall.removed', {path: file}));
        for (const item of errors) report(reporter, 'error', t('uninstall.remaining', {path: item.path, code: item.code}));
        throw Object.assign(createCliError(t('uninstall.failed', {alias: canonicalAlias, reason: t('uninstall.partial')})), {result: {removed, errors, dataPolicy: preview.dataPolicy}});
    }
    registry.removePlugin(canonicalAlias);
    report(reporter, 'success', t('uninstall.success', {alias: canonicalAlias}));
    report(reporter, 'info', t('uninstall.dataPolicy.' + preview.dataPolicy));
    return {status: 'uninstalled', alias: canonicalAlias, dataPolicy: preview.dataPolicy, removed, errors};
}

export async function updatePlugin(alias, options = {}) {
    const reporter = options.reporter;
    const canonicalAlias = preparePluginAlias(alias, reporter);
    const plugin = registry.getPlugin(canonicalAlias);

    if (!plugin) {
        throw createCliError(t('uninstall.notInstalled', {alias: canonicalAlias}));
    }

    report(reporter, 'info', t('update.start', {alias: canonicalAlias}));
    report(reporter, 'info', t('update.currentVersion', {version: plugin.version}));

    try {
        report(reporter, 'info', t('update.checking'));
        const result = await performPluginUpdate(canonicalAlias, plugin, reporter);

        if (result.status === 'latest') {
            report(reporter, 'success', t('update.latest', {alias: canonicalAlias, version: result.version}));
            return result;
        }

        if (result.status === 'migrated') {
            report(reporter, 'success', t('update.migrated', {alias: canonicalAlias, version: result.version}));
            return result;
        }

        report(reporter, 'success', t('update.updated', {
            alias: canonicalAlias,
            oldVersion: result.oldVersion,
            newVersion: result.newVersion
        }));
        return result;
    } catch (error) {
        throw createCliError(t('update.failed', {alias: canonicalAlias, reason: error.message}));
    }
}

export async function updateAllPlugins(options = {}) {
    const reporter = options.reporter;
    const migration = migrateSlothvaultPluginAlias();
    if (migration.plugin === 'conflict') {
        throw createCliError(t('pluginAliases.migrationConflict'), 'SLOTHVAULT_ALIAS_MIGRATION_CONFLICT');
    }
    const plugins = registry.getAllPlugins();
    const aliases = [...new Set(Object.keys(plugins).map(normalizePluginAlias))];

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

export async function updateSelf(options = {}) {
    const reporter = options.reporter;
    report(reporter, 'info', t('selfUpdate.start'));

    try {
        await runCommand(getNpmBinary(), ['install', '-g', '@holic512/slothtool'], {
            env: getProxyCommandEnv()
        });
        report(reporter, 'success', t('selfUpdate.success'));
        return {status: 'updated'};
    } catch (error) {
        throw createCliError(t('selfUpdate.failed', {reason: error.message}));
    }
}

export function describeUninstallAll(options = {}) {
    const slothtoolDir = getSlothToolHome();
    const plugins = registry.getAllPlugins();
    const dataPolicy = options.dataPolicy || 'purge';
    const vault = planSlothVaultCleanup({...options, uninstall: true, purgeData: dataPolicy === 'purge', slothtoolExecutable: resolveVerifiedSlothToolCommandPath(options)});
    const programPaths = [getPluginsDir(), path.join(slothtoolDir, 'runtimes/slothvault')];
    return {
        slothtoolDir,
        exists: fs.existsSync(slothtoolDir),
        pluginCount: Object.keys(plugins).length, vault, dataPolicy, programPaths,
        paths: [...new Set([...(dataPolicy === 'purge' ? [slothtoolDir] : programPaths), ...vault.items.filter(item => item.external).map(item => item.path)])]
    };
}

export function uninstallAllData(options = {}) {
    const reporter = options.reporter;
    const preview = describeUninstallAll(options);

    if (!preview.exists && !preview.vault.items.some(item => item.external)) {
        report(reporter, 'info', t('uninstallAll.noData', {dir: preview.slothtoolDir}));
        report(reporter, 'info', t('uninstallAll.alreadyClean'));
        return {
            removed: false,
            ...preview
        };
    }

    const dataPolicy = options.dataPolicy || 'purge';
    if (!['keep', 'purge'].includes(dataPolicy)) throw createCliError('Invalid uninstall data policy.');
    const removed = [], errors = [], localRemoved = [];
    for (const alias of Object.keys(registry.getAllPlugins())) {
        try {removed.push(uninstallPlugin(alias, {...options, dataPolicy}));}
        catch (error) {errors.push({alias, code: error.code || 'UNINSTALL_FAILED', result: error.result});}
    }
    // Also remove verified links left behind by an already absent interface.
    try {
        const vault = cleanupSlothVault({...options, uninstall: true, purgeData: dataPolicy === 'purge', slothtoolExecutable: resolveVerifiedSlothToolCommandPath(options)});
        localRemoved.push(...vault.removed.map(item => item.path));
        errors.push(...vault.errors);
    } catch (error) {errors.push({code: error.code || 'UNINSTALL_FAILED'});}
    if (errors.length) {
        for (const file of localRemoved) report(reporter, 'info', t('uninstall.removed', {path: file}));
        for (const item of errors) report(reporter, 'error', t('uninstall.remaining', {path: item.path || item.alias || preview.slothtoolDir, code: item.code}));
        throw Object.assign(createCliError(t('uninstallAll.failed', {reason: t('uninstall.partial')})), {result: {removed, localRemoved, errors}});
    }
    if (dataPolicy === 'purge') removePath(preview.slothtoolDir);
    else for (const file of preview.programPaths) removeOwnedPath(file, preview.slothtoolDir);
    report(reporter, 'success', t('uninstallAll.success'));
    return {removed: true, dataPolicy, results: removed.map(result => ({...result, title: result.alias})), localRemoved, ...preview};
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
    resolveExtractedPackageRoot,
    selectReleaseAssetForEnvironment,
    readInstalledPluginUi,
    recordPluginRun,
    resolvePluginLaunch,
    runInstalledPlugin,
    uninstallAllData,
    uninstallPlugin,
    updateAllPlugins,
    updatePlugin,
    updateSelf
};
