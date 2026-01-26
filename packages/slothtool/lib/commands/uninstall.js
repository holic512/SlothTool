const { uninstallPlugin } = require('../plugin-manager');

function uninstall(args) {
  if (args.length === 0) {
    console.error('Error: Please specify a plugin to uninstall.');
    console.log('Usage: slothtool uninstall <plugin-alias>');
    console.log('Example: slothtool uninstall loc');
    process.exit(1);
  }

  const alias = args[0];
  uninstallPlugin(alias);
}

module.exports = uninstall;
