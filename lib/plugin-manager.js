/**
 * @file PluginManager
 * @project SlothTool
 * @module Core CLI / Plugin Lifecycle
 * @description 负责官方插件的 GitHub Release 安装更新、遗留 npm 插件兼容更新、自更新与卸载。
 * @logic 1. 通过官方插件元数据解析 GitHub Release；2. 下载源码包并在本地安装生产依赖；3. 兼容旧注册表中的 npm 来源插件更新与迁移。
 * @dependencies Node: child_process/fs/https/os/path, Data: official-plugins.json, Service: registry
 * @index_tags 插件安装, GitHub Release, 插件更新, npm兼容, 注册表迁移
 * @author holic512
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const registry = require('./registry');
const {getPluginDir, ensureDir, getPluginsDir, getPluginConfigPath} = require('./utils');
const {t} = require('./i18n');

const officialPlugins = require('./official-plugins.json').officialPlugins;

const GITHUB_API_BASE = 'https://api.github.com';
const officialPluginMap = new Map(officialPlugins.map(plugin => [plugin.alias, plugin]));

function createCliError(message) {
    const error = new Error(message);
    error.cli = true;
    return error;
}

function markHandled(error) {
    error.handled = true;
    return error;
}

function getOfficialPlugin(alias) {
    return officialPluginMap.get(alias) || null;
}

function isOfficialPlugin(alias) {
    return officialPluginMap.has(alias);
}

function getOfficialPluginAliases() {
    return officialPlugins.map(plugin => plugin.alias);
}

function getPluginPackageName(pluginInfo) {
    return pluginInfo.packageName || pluginInfo.name;
}

function removeDir(targetPath) {
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, {recursive: true, force: true});
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
        const binKey = Object.keys(pkg.bin)[0];
        return pkg.bin[binKey];
    }

    throw new Error(`No bin field found in package.json for ${pkg.name}`);
}

function resolveBinPath(installRoot, pkg) {
    const binRelativePath = resolveBinRelativePath(pkg);
    const binPath = path.join(installRoot, binRelativePath);

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
            const linkTarget = fs.readlinkSync(sourcePath);
            fs.symlinkSync(linkTarget, targetPath);
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

        removeDir(pluginDir);
        ensureDir(pluginDir);
        copyDirectoryContents(stagedDir, pluginDir);
    } catch (error) {
        removeDir(pluginDir);

        if (backupDir && fs.existsSync(backupDir)) {
            fs.renameSync(backupDir, pluginDir);
        }

        throw error;
    }

    if (backupDir && fs.existsSync(backupDir)) {
        removeDir(backupDir);
    }

    return pluginDir;
}

function githubRequestJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'SlothTool'
            }
        }, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                githubRequestJson(response.headers.location).then(resolve).catch(reject);
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

function downloadFile(url, targetPath, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Too many redirects while downloading plugin asset.'));
            return;
        }

        const request = https.get(url, {
            headers: {
                'Accept': 'application/octet-stream',
                'User-Agent': 'SlothTool'
            }
        }, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                downloadFile(response.headers.location, targetPath, redirectCount + 1).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`Failed to download plugin asset (${response.statusCode}).`));
                return;
            }

            const fileStream = fs.createWriteStream(targetPath);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close(resolve);
            });

            fileStream.on('error', error => {
                fileStream.close(() => {
                    removeDir(targetPath);
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

async function fetchLatestOfficialRelease(pluginMeta) {
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
            const asset = (matchingRelease.assets || []).find(item =>
                typeof item.name === 'string' &&
                item.name.startsWith(pluginMeta.assetNamePrefix) &&
                item.name.endsWith('.tgz')
            );

            if (!asset) {
                throw new Error(`No release asset found for ${pluginMeta.alias} in ${matchingRelease.tag_name}.`);
            }

            return {
                asset,
                release: matchingRelease,
                version: extractReleaseVersion(pluginMeta, matchingRelease)
            };
        }

        page += 1;
    }

    throw new Error(`No GitHub release found for official plugin "${pluginMeta.alias}".`);
}

async function stageOfficialPluginRelease(pluginMeta, releaseInfo) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-plugin-'));
    const tarballPath = path.join(tempRoot, releaseInfo.asset.name);
    const extractDir = path.join(tempRoot, 'extract');
    const buildDir = path.join(tempRoot, 'build');

    ensureDir(extractDir);
    ensureDir(buildDir);

    try {
        console.log(t('downloadingAsset', {assetName: releaseInfo.asset.name}));
        await downloadFile(releaseInfo.asset.browser_download_url, tarballPath);

        execFileSync('tar', ['-xzf', tarballPath, '-C', extractDir]);

        const packageRoot = path.join(extractDir, 'package');
        const packageJsonPath = path.join(packageRoot, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`package.json not found in release asset: ${releaseInfo.asset.name}`);
        }

        copyDirectoryContents(packageRoot, buildDir);

        console.log(t('installingDependencies'));
        execFileSync('npm', ['install', '--omit=dev'], {
            cwd: buildDir,
            stdio: 'inherit'
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
        removeDir(tempRoot);
        throw error;
    }
}

async function installOfficialPluginRelease(alias, pluginMeta, releaseInfo, existingPlugin = null) {
    const staged = await stageOfficialPluginRelease(pluginMeta, releaseInfo);

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
            assetName: releaseInfo.asset.name
        };

        if (existingPlugin) {
            registryEntry.updatedAt = now;
        }

        registry.addPlugin(alias, registryEntry);
        return registryEntry;
    } finally {
        removeDir(staged.tempRoot);
    }
}

function updateLegacyRegistryEntry(alias, plugin, pkg, pluginRoot) {
    const now = new Date().toISOString();
    const packageName = getPluginPackageName(plugin);

    registry.addPlugin(alias, {
        ...plugin,
        name: packageName,
        packageName: packageName,
        version: pkg.version,
        binPath: resolveBinPath(pluginRoot, pkg),
        installedAt: plugin.installedAt,
        updatedAt: now,
        sourceType: plugin.sourceType || 'npm-registry'
    });
}

async function updateOfficialPlugin(alias, plugin, pluginMeta) {
    const releaseInfo = await fetchLatestOfficialRelease(pluginMeta);
    const needsMigration = plugin.sourceType !== 'github-release';

    if (!needsMigration && plugin.version === releaseInfo.version && plugin.releaseTag === releaseInfo.release.tag_name) {
        return {
            status: 'latest',
            version: plugin.version
        };
    }

    const updatedPlugin = await installOfficialPluginRelease(alias, pluginMeta, releaseInfo, plugin);

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
    const packageName = getPluginPackageName(plugin);
    const packageRoot = path.join(pluginDir, 'node_modules', packageName);

    execFileSync('npm', ['update', packageName, '--prefix', pluginDir], {
        stdio: 'inherit'
    });

    const pkgPath = path.join(packageRoot, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        throw new Error(`Package.json not found at: ${pkgPath}`);
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

async function performPluginUpdate(alias, plugin) {
    const officialPlugin = getOfficialPlugin(alias);

    if (officialPlugin) {
        return updateOfficialPlugin(alias, plugin, officialPlugin);
    }

    return updateLegacyPlugin(alias, plugin);
}

async function installPlugin(alias) {
    const officialPlugin = getOfficialPlugin(alias);

    if (!officialPlugin) {
        throw createCliError(
            t('officialPluginOnly', {
                aliases: getOfficialPluginAliases().join(', '),
                alias
            })
        );
    }

    console.log(t('installing'), `${alias}...`);

    if (registry.hasPlugin(alias)) {
        console.log(t('alreadyInstalled', {alias}));
        console.log(t('uninstallFirst', {alias}));
        return;
    }

    ensureDir(getPluginsDir());

    try {
        console.log(t('checkingUpdates'));
        const releaseInfo = await fetchLatestOfficialRelease(officialPlugin);
        console.log(t('installingTo'), getPluginDir(alias));
        await installOfficialPluginRelease(alias, officialPlugin, releaseInfo);
        console.log(t('installSuccess', {alias}));
        console.log(t('installRun', {alias}));
    } catch (error) {
        console.error(t('installFailed', {packageName: officialPlugin.packageName}), error.message);
        removeDir(getPluginDir(alias));
        throw markHandled(error);
    }
}

function uninstallPlugin(alias) {
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        console.error(t('notInstalled', {alias}));
        process.exit(1);
    }

    console.log(t('uninstalling'), alias + '...');

    const pluginDir = getPluginDir(alias);
    const configPath = getPluginConfigPath(alias);
    const hasConfig = fs.existsSync(configPath);

    console.log(t('uninstallWillRemove'));
    console.log(t('uninstallPluginDir', {dir: pluginDir}));

    if (hasConfig) {
        console.log(t('uninstallConfigFile', {file: configPath}));
    } else {
        console.log(t('uninstallNoConfig'));
    }

    console.log(t('uninstallRegistryEntry'));
    console.log('');

    try {
        removeDir(pluginDir);

        if (hasConfig) {
            fs.rmSync(configPath, {force: true});
        }

        registry.removePlugin(alias);
        console.log(t('uninstallSuccess', {alias}));
    } catch (error) {
        console.error(t('uninstallFailed', {alias}), error.message);
        process.exit(1);
    }
}

async function updatePlugin(alias) {
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        throw createCliError(t('notInstalled', {alias}));
    }

    console.log(t('updating'), `${alias} (${getPluginPackageName(plugin)})...`);
    console.log(t('currentVersion'), plugin.version);

    try {
        console.log(t('checkingUpdates'));
        const result = await performPluginUpdate(alias, plugin);

        if (result.status === 'latest') {
            console.log(t('alreadyLatest', {alias, version: result.version}));
            return result;
        }

        if (result.status === 'migrated') {
            console.log(t('migrationSuccess', {alias, version: result.version}));
            return result;
        }

        console.log(t('updateSuccess', {
            alias,
            oldVersion: result.oldVersion,
            newVersion: result.newVersion
        }));

        return result;
    } catch (error) {
        console.error(t('updateFailed', {alias}), error.message);
        throw markHandled(error);
    }
}

function updateSelf() {
    console.log(t('selfUpdate.starting'));

    try {
        execFileSync('npm', ['install', '-g', '@holic512/slothtool'], {
            stdio: 'inherit'
        });

        console.log(t('selfUpdate.success'));
    } catch (error) {
        console.error(t('selfUpdate.failed'), error.message);
        process.exit(1);
    }
}

async function updateAllPlugins() {
    const plugins = registry.getAllPlugins();
    const pluginList = Object.keys(plugins);

    if (pluginList.length === 0) {
        console.log(t('noPlugins'));
        return;
    }

    console.log(t('updateAll.title'));
    console.log(t('updateAll.foundPlugins', {count: pluginList.length}));
    console.log('');

    let updatedCount = 0;
    let alreadyLatestCount = 0;
    let failedCount = 0;

    for (const alias of pluginList) {
        const plugin = plugins[alias];

        console.log('─'.repeat(50));
        console.log(t('updating'), `${alias} (${getPluginPackageName(plugin)})...`);
        console.log(t('currentVersion'), plugin.version);

        try {
            console.log(t('checkingUpdates'));
            const result = await performPluginUpdate(alias, plugin);

            if (result.status === 'latest') {
                console.log(t('alreadyLatest', {alias, version: result.version}));
                alreadyLatestCount++;
            } else if (result.status === 'migrated') {
                console.log(t('migrationSuccess', {alias, version: result.version}));
                updatedCount++;
            } else {
                console.log(t('updateSuccess', {
                    alias,
                    oldVersion: result.oldVersion,
                    newVersion: result.newVersion
                }));
                updatedCount++;
            }
        } catch (error) {
            console.error(t('updateFailed', {alias}), error.message);
            failedCount++;
        }

        console.log('');
    }

    console.log('═'.repeat(50));
    console.log(t('updateAll.summary'));
    console.log(t('updateAll.totalPlugins', {count: pluginList.length}));
    console.log(t('updateAll.updated', {count: updatedCount}));
    console.log(t('updateAll.alreadyLatest', {count: alreadyLatestCount}));
    console.log(t('updateAll.failed', {count: failedCount}));
}

module.exports = {
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    updateAllPlugins,
    updateSelf,
    getOfficialPlugin,
    getOfficialPluginAliases,
    isOfficialPlugin
};
