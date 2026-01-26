const registry = require('../registry');
const {t} = require('../i18n');

function list() {
    const plugins = registry.getAllPlugins();

    if (Object.keys(plugins).length === 0) {
        console.log(t('noPlugins'));
        console.log(t('installExample'));
        console.log('  slothtool install <plugin-name>');
        return;
    }

    console.log(t('installedPlugins') + '\n');
    for (const [alias, info] of Object.entries(plugins)) {
        console.log(`  ${alias}`);
        console.log(`    Package: ${info.name}`);
        console.log(`    Version: ${info.version}`);
        console.log(`    Installed: ${new Date(info.installedAt).toLocaleString()}`);
        console.log('');
    }
}

module.exports = list;
