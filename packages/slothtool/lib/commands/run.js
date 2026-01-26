const { spawn } = require('child_process');
const registry = require('../registry');

function run(args) {
  if (args.length === 0) {
    console.error('Error: Please specify a plugin to run.');
    console.log('Usage: slothtool run <plugin-alias> [args...]');
    console.log('   or: slothtool <plugin-alias> [args...]');
    console.log('\nExample: slothtool run loc ./src');
    console.log('     or: slothtool loc ./src');
    process.exit(1);
  }

  const pluginAlias = args[0];
  const pluginArgs = args.slice(1);

  const plugin = registry.getPlugin(pluginAlias);

  if (!plugin) {
    console.error(`Error: Plugin "${pluginAlias}" not found.`);
    console.log(`\nRun "slothtool list" to see installed plugins.`);
    console.log(`Or install it with: slothtool install <plugin-name>`);
    process.exit(1);
  }

  // 调用插件
  const child = spawn('node', [plugin.binPath, ...pluginArgs], {
    stdio: 'inherit'
  });

  child.on('error', (error) => {
    console.error(`Failed to run plugin "${pluginAlias}":`, error.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

module.exports = run;
