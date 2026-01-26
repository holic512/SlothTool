const { installPlugin } = require('../plugin-manager');

function install(args) {
  if (args.length === 0) {
    console.error('Error: Please specify a plugin to install.');
    console.log('Usage: slothtool install <plugin-name>');
    console.log('Example: slothtool install @slothtool/plugin-loc');
    process.exit(1);
  }

  const packageName = args[0];
  installPlugin(packageName);
}

module.exports = install;
