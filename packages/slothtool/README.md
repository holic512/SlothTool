# SlothTool

🐌 A lightweight plugin manager and dispatcher for CLI tools.

[![npm version](https://img.shields.io/npm/v/@holic512/slothtool.svg)](https://www.npmjs.com/package/@holic512/slothtool)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Overview

SlothTool is a plugin management system that allows you to install, manage, and run CLI tools as plugins without
polluting your global npm environment. All plugins are installed in an isolated directory (`~/.slothtool/plugins/`) with
their own dependencies.

## Features

- 🔒 **Zero Global Pollution**: Plugins install to `~/.slothtool/plugins/` instead of global npm
- 📦 **Plugin Isolation**: Each plugin has its own dependencies in isolated directories
- 🌍 **Bilingual Support**: Full Chinese and English interface (configurable)
- 🎯 **Simple CLI**: Easy-to-use commands with shorthand syntax
- 🎨 **Interactive Mode**: Menu-driven interface for easier operation
- ⚡ **Lightweight**: Only one runtime dependency (`prompts`)

## Installation

```bash
npm install -g @holic512/slothtool
```

## Quick Start

```bash
# Install a plugin
slothtool install @holic512/plugin-loc

# Run the plugin (shorthand)
slothtool loc ./src

# Or use explicit run command
slothtool run loc ./src

# List installed plugins
slothtool list

# Configure language (default: Chinese)
slothtool config language en

# Interactive mode
slothtool -i
```

## Commands

### Core Commands

| Command                              | Description                    |
|--------------------------------------|--------------------------------|
| `slothtool install <plugin>`         | Install a plugin from npm      |
| `slothtool uninstall <plugin>`       | Uninstall a plugin             |
| `slothtool list`                     | List all installed plugins     |
| `slothtool run <plugin> [args]`      | Run a plugin with arguments    |
| `slothtool <plugin> [args]`          | Shorthand for running a plugin |
| `slothtool config language <zh\|en>` | Configure interface language   |
| `slothtool -i, --interactive`        | Launch interactive mode        |
| `slothtool --help`                   | Show help information          |

### Examples

```bash
# Install official plugin
slothtool install @holic512/plugin-loc

# Install any npm package with bin field
slothtool install some-cli-tool

# Run plugin with arguments
slothtool loc ./src --verbose

# Uninstall plugin
slothtool uninstall loc

# Switch to English interface
slothtool config language en

# Use interactive mode
slothtool -i
```

## How It Works

SlothTool manages CLI tools as isolated plugins:

1. **Installation**: Plugins are npm packages with a `bin` field
2. **Storage**: Downloaded to `~/.slothtool/plugins/<alias>/` with isolated dependencies
3. **Registry**: Maintains a registry at `~/.slothtool/registry.json` tracking installed plugins
4. **Execution**: Spawns the plugin's executable when you run it
5. **Configuration**: User settings stored in `~/.slothtool/settings.json`

### Directory Structure

```
~/.slothtool/
├── plugins/              # Plugin installation directory
│   ├── loc/             # Example: loc plugin
│   │   └── node_modules/
│   └── another-plugin/
├── plugin-configs/       # Plugin-specific configurations
│   └── loc.json
├── registry.json         # Plugin registry
└── settings.json         # User settings (language, etc.)
```

## Configuration

### Language Settings

SlothTool supports Chinese (zh) and English (en):

```bash
# Switch to English
slothtool config language en

# Switch to Chinese (default)
slothtool config language zh

# View current language
slothtool config
```

### Plugin Alias Extraction

Package names are automatically converted to simple aliases:

- `@holic512/plugin-loc` → `loc`
- `plugin-mytool` → `mytool`
- `some-tool` → `some-tool`

## Official Plugins

- [@holic512/plugin-loc](../plugin-loc) - Lines of code counter with interactive features

## Creating Plugins

Any npm package with a `bin` field can be a SlothTool plugin.

### Basic Plugin Structure

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "description": "My awesome CLI tool",
  "bin": {
    "mytool": "bin/mytool.js"
  },
  "keywords": [
    "slothtool-plugin",
    "cli"
  ]
}
```

### Plugin Best Practices

1. **Naming Convention**: Use `plugin-` prefix or include in package scope
2. **Keywords**: Add `slothtool-plugin` keyword for discoverability
3. **Internationalization**: Read language from `~/.slothtool/settings.json` for i18n support
4. **Configuration**: Store plugin-specific config in `~/.slothtool/plugin-configs/<alias>.json`
5. **Interactive Features**: Use `prompts` library for better UX

### Example Plugin with i18n

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// Read language setting from slothtool
function getLanguage() {
    const settingsPath = path.join(os.homedir(), '.slothtool', 'settings.json');
    if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return settings.language || 'zh';
    }
    return 'zh';
}

const messages = {
    zh: {greeting: '你好，世界！'},
    en: {greeting: 'Hello, World!'}
};

const lang = getLanguage();
console.log(messages[lang].greeting);
```

### Publishing Your Plugin

```bash
# Publish to npm
npm publish --access public

# Users can then install it
slothtool install @yourscope/plugin-mytool
slothtool mytool
```

## Interactive Mode

Launch interactive mode for a menu-driven experience:

```bash
slothtool -i
```

Features:

- Install official or custom plugins
- Uninstall plugins
- List installed plugins
- Run plugins
- Configure language settings

## Uninstalling

### Uninstall a Plugin

When you uninstall a plugin, SlothTool will automatically remove:

- Plugin directory and all its dependencies (`~/.slothtool/plugins/<alias>/`)
- Plugin-specific configuration file (`~/.slothtool/plugin-configs/<alias>.json`)
- Registry entry from `~/.slothtool/registry.json`

```bash
# Uninstall a specific plugin
slothtool uninstall <plugin-alias>

# Example
slothtool uninstall loc
```

The uninstall command will show you exactly what will be removed before proceeding.

### Complete Uninstallation

To completely remove SlothTool and all its data from your system:

#### Option 1: Using the built-in command (recommended)

```bash
# Remove all plugins, configurations, and SlothTool data
slothtool --uninstall-all
```

This will remove:
- All installed plugins (`~/.slothtool/plugins/`)
- All plugin configurations (`~/.slothtool/plugin-configs/`)
- Registry file (`~/.slothtool/registry.json`)
- Settings file (`~/.slothtool/settings.json`)
- The entire `~/.slothtool/` directory

Then uninstall the global SlothTool package:

```bash
npm uninstall -g @holic512/slothtool
```

#### Option 2: Manual removal

```bash
# 1. Remove all SlothTool data
rm -rf ~/.slothtool/

# 2. Uninstall the global package
npm uninstall -g @holic512/slothtool
```

### What Gets Removed

Here's a complete breakdown of what SlothTool stores on your system:

```
~/.slothtool/
├── plugins/              # All installed plugins and their dependencies
│   ├── loc/             # Example: loc plugin
│   │   ├── node_modules/
│   │   └── package.json
│   └── [other-plugins]/
├── plugin-configs/       # Plugin-specific configurations
│   ├── loc.json         # Example: loc plugin config
│   └── [other-configs].json
├── registry.json         # Plugin registry (tracks installed plugins)
└── settings.json         # User settings (language preference, etc.)
```

**Note**: SlothTool only stores data in `~/.slothtool/`. No other system files or directories are modified.

## Troubleshooting

### Plugin Not Found

```bash
# Check installed plugins
slothtool list

# Reinstall if needed
slothtool uninstall <plugin>
slothtool install <plugin>
```

### Permission Issues

SlothTool installs to user directory (`~/.slothtool/`), so no sudo is required. If you encounter permission issues:

```bash
# Check directory permissions
ls -la ~/.slothtool/

# Fix permissions if needed
chmod -R u+w ~/.slothtool/
```

## Development

### Local Development

```bash
# Clone repository
git clone https://github.com/holic512/SlothTool.git
cd SlothTool

# Install dependencies
npm install

# Link for local testing
cd packages/slothtool
npm link

# Test the CLI
slothtool --help
```

### Project Structure

```
packages/slothtool/
├── bin/
│   └── slothtool.js          # CLI entry point
├── lib/
│   ├── commands/             # Command implementations
│   │   ├── install.js
│   │   ├── uninstall.js
│   │   ├── list.js
│   │   ├── run.js
│   │   ├── config.js
│   │   └── interactive.js
│   ├── i18n.js               # Internationalization
│   ├── plugin-manager.js     # Plugin installation/uninstallation
│   ├── registry.js           # Registry management
│   ├── settings.js           # Settings management
│   └── utils.js              # Utility functions
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Related Documentation

- [Configuration Analysis](../../docs/slothtool-configuration-analysis.md) - Detailed analysis of the codebase
- [npm link vs SlothTool](../../docs/npm-link-vs-slothtool.md) - Comparison with npm link

## License

ISC

## Author

holic512
