const registry = require('../registry');

function list() {
  const plugins = registry.getAllPlugins();

  if (Object.keys(plugins).length === 0) {
    console.log('No plugins installed.');
    console.log('\nInstall a plugin with: slothtool install <plugin-name>');
    return;
  }

  console.log('Installed plugins:\n');
  for (const [alias, info] of Object.entries(plugins)) {
    console.log(`  ${alias}`);
    console.log(`    Package: ${info.name}`);
    console.log(`    Version: ${info.version}`);
    console.log(`    Installed: ${new Date(info.installedAt).toLocaleString()}`);
    console.log('');
  }
}

module.exports = list;
