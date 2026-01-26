const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const registry = require('./registry');
const {extractPluginAlias, getPluginDir, ensureDir, getPluginsDir, getPluginConfigPath} = require('./utils');
const {t} = require('./i18n');

/**
 * 安装插件
 * @param {string} packageName - npm 包名 (例如: @slothtool/plugin-loc 或 plugin-loc)
 */
function installPlugin(packageName) {
    console.log(t('installing'), packageName + '...');

    // 提取插件别名
    const alias = extractPluginAlias(packageName);

    // 检查是否已安装
    if (registry.hasPlugin(alias)) {
        console.log(t('alreadyInstalled', {alias}));
        console.log(t('uninstallFirst', {alias}));
        return;
    }

    // 确保插件目录存在
    ensureDir(getPluginsDir());

    const pluginDir = getPluginDir(alias);
    ensureDir(pluginDir);

    try {
        // 使用 npm install 安装插件到指定目录
        console.log(t('installingTo'), pluginDir);
        execSync(`npm install ${packageName} --prefix "${pluginDir}"`, {
            stdio: 'inherit',
            encoding: 'utf8'
        });

        // 读取插件的 package.json
        const pkgPath = path.join(pluginDir, 'node_modules', packageName, 'package.json');

        if (!fs.existsSync(pkgPath)) {
            throw new Error(`Package.json not found at: ${pkgPath}`);
        }

        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        // 获取 bin 路径
        let binPath;
        if (typeof pkg.bin === 'string') {
            binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin);
        } else if (typeof pkg.bin === 'object') {
            // 如果 bin 是对象，取第一个值
            const binKey = Object.keys(pkg.bin)[0];
            binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin[binKey]);
        } else {
            throw new Error(`No bin field found in package.json for ${packageName}`);
        }

        // 验证 bin 文件存在
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bin file not found at: ${binPath}`);
        }

        // 添加到注册表
        registry.addPlugin(alias, {
            name: packageName,
            version: pkg.version,
            binPath: binPath,
            installedAt: new Date().toISOString()
        });

        console.log(t('installSuccess', {alias}));
        console.log(t('installRun', {alias}));

    } catch (error) {
        console.error(t('installFailed', {packageName}), error.message);

        // 清理失败的安装
        if (fs.existsSync(pluginDir)) {
            fs.rmSync(pluginDir, {recursive: true, force: true});
        }

        process.exit(1);
    }
}

/**
 * 卸载插件
 * @param {string} alias - 插件别名
 */
function uninstallPlugin(alias) {
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        console.error(t('notInstalled', {alias}));
        process.exit(1);
    }

    console.log(t('uninstalling'), alias + '...');

    // 显示将要删除的内容
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
        // 删除插件目录
        if (fs.existsSync(pluginDir)) {
            fs.rmSync(pluginDir, {recursive: true, force: true});
        }

        // 删除插件配置文件（如果存在）
        if (hasConfig) {
            fs.rmSync(configPath, {force: true});
        }

        // 从注册表移除
        registry.removePlugin(alias);

        console.log(t('uninstallSuccess', {alias}));

    } catch (error) {
        console.error(t('uninstallFailed', {alias}), error.message);
        process.exit(1);
    }
}

/**
 * 更新插件
 * @param {string} alias - 插件别名
 */
function updatePlugin(alias) {
    const plugin = registry.getPlugin(alias);

    if (!plugin) {
        console.error(t('notInstalled', {alias}));
        process.exit(1);
    }

    console.log(t('updating'), `${alias} (${plugin.name})...`);
    console.log(t('currentVersion'), plugin.version);

    const pluginDir = getPluginDir(alias);
    const packageName = plugin.name;

    try {
        // 使用 npm update 更新插件
        console.log(t('checkingUpdates'));
        execSync(`npm update ${packageName} --prefix "${pluginDir}"`, {
            stdio: 'inherit',
            encoding: 'utf8'
        });

        // 读取更新后的 package.json
        const pkgPath = path.join(pluginDir, 'node_modules', packageName, 'package.json');

        if (!fs.existsSync(pkgPath)) {
            throw new Error(`Package.json not found at: ${pkgPath}`);
        }

        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        // 检查版本是否有变化
        if (pkg.version === plugin.version) {
            console.log(t('alreadyLatest', {alias, version: pkg.version}));
            return;
        }

        // 获取 bin 路径
        let binPath;
        if (typeof pkg.bin === 'string') {
            binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin);
        } else if (typeof pkg.bin === 'object') {
            const binKey = Object.keys(pkg.bin)[0];
            binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin[binKey]);
        } else {
            throw new Error(`No bin field found in package.json for ${packageName}`);
        }

        // 验证 bin 文件存在
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bin file not found at: ${binPath}`);
        }

        // 更新注册表
        registry.addPlugin(alias, {
            name: packageName,
            version: pkg.version,
            binPath: binPath,
            installedAt: plugin.installedAt,
            updatedAt: new Date().toISOString()
        });

        console.log(t('updateSuccess', {alias, oldVersion: plugin.version, newVersion: pkg.version}));

    } catch (error) {
        console.error(t('updateFailed', {alias}), error.message);
        process.exit(1);
    }
}

/**
 * 更新所有插件
 */
function updateAllPlugins() {
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
    const results = [];

    for (const alias of pluginList) {
        const plugin = plugins[alias];
        console.log('─'.repeat(50));
        console.log(t('updating'), `${alias} (${plugin.name})...`);
        console.log(t('currentVersion'), plugin.version);

        const pluginDir = getPluginDir(alias);
        const packageName = plugin.name;

        try {
            // 使用 npm update 更新插件
            execSync(`npm update ${packageName} --prefix "${pluginDir}"`, {
                stdio: 'pipe',
                encoding: 'utf8'
            });

            // 读取更新后的 package.json
            const pkgPath = path.join(pluginDir, 'node_modules', packageName, 'package.json');

            if (!fs.existsSync(pkgPath)) {
                throw new Error(`Package.json not found at: ${pkgPath}`);
            }

            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

            // 检查版本是否有变化
            if (pkg.version === plugin.version) {
                console.log(t('alreadyLatest', {alias, version: pkg.version}));
                alreadyLatestCount++;
                results.push({alias, status: 'latest', version: pkg.version});
            } else {
                // 获取 bin 路径
                let binPath;
                if (typeof pkg.bin === 'string') {
                    binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin);
                } else if (typeof pkg.bin === 'object') {
                    const binKey = Object.keys(pkg.bin)[0];
                    binPath = path.join(pluginDir, 'node_modules', packageName, pkg.bin[binKey]);
                } else {
                    throw new Error(`No bin field found in package.json for ${packageName}`);
                }

                // 验证 bin 文件存在
                if (!fs.existsSync(binPath)) {
                    throw new Error(`Bin file not found at: ${binPath}`);
                }

                // 更新注册表
                registry.addPlugin(alias, {
                    name: packageName,
                    version: pkg.version,
                    binPath: binPath,
                    installedAt: plugin.installedAt,
                    updatedAt: new Date().toISOString()
                });

                console.log(t('updateSuccess', {alias, oldVersion: plugin.version, newVersion: pkg.version}));
                updatedCount++;
                results.push({alias, status: 'updated', oldVersion: plugin.version, newVersion: pkg.version});
            }

        } catch (error) {
            console.error(t('updateFailed', {alias}), error.message);
            failedCount++;
            results.push({alias, status: 'failed', error: error.message});
        }

        console.log('');
    }

    // 显示总结
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
    updateAllPlugins
};
