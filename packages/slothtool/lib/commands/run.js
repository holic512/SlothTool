const {spawn} = require('child_process');
const registry = require('../registry');
const {t} = require('../i18n');

function run(args) {
    if (args.length === 0) {
        console.error(t('specifyPlugin'));
        console.log(t('usage'));
        console.log('  slothtool run <plugin-alias> [args...]');
        console.log('  slothtool <plugin-alias> [args...]');
        console.log('\n' + t('examples'));
        console.log('  slothtool run loc ./src');
        console.log('  slothtool loc ./src');
        process.exit(1);
    }

    const pluginAlias = args[0];
    const pluginArgs = args.slice(1);

    const plugin = registry.getPlugin(pluginAlias);

    if (!plugin) {
        console.error(t('pluginNotFound', {pluginAlias}));
        console.log(t('seeInstalled'));
        console.log(t('orInstall'));
        process.exit(1);
    }

    // 调用插件
    const child = spawn('node', [plugin.binPath, ...pluginArgs], {
        stdio: 'inherit'
    });

    child.on('error', (error) => {
        console.error(t('failedToRun', {pluginAlias}), error.message);
        process.exit(1);
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
}

module.exports = run;
