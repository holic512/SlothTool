# Plugin Development Guide

This guide will help you create plugins for SlothTool.

## Table of Contents

- [Plugin Basics](#plugin-basics)
- [Plugin Structure](#plugin-structure)
- [Interactive Mode Support](#interactive-mode-support)
- [Internationalization (i18n)](#internationalization-i18n)
- [Plugin Configuration](#plugin-configuration)
- [Best Practices](#best-practices)
- [Publishing Your Plugin](#publishing-your-plugin)
- [Adding to Official Plugin List](#adding-to-official-plugin-list)

## Plugin Basics

A SlothTool plugin is simply an npm package with a `bin` field in its `package.json`. When users install your plugin through SlothTool, they can run it using the plugin alias.

### Minimum Requirements

1. A valid npm package with `package.json`
2. A `bin` field pointing to an executable JavaScript file
3. The bin file must start with `#!/usr/bin/env node`

## Plugin Structure

### Basic Structure

```
my-plugin/
├── package.json
├── bin/
│   └── my-tool.js       # Entry point
└── lib/
    └── index.js         # Core logic
```

### package.json

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "description": "Your plugin description",
  "main": "lib/index.js",
  "bin": {
    "mytool": "bin/my-tool.js"
  },
  "keywords": [
    "slothtool",
    "plugin"
  ],
  "author": "Your Name",
  "license": "ISC"
}
```

### bin/my-tool.js

```javascript
#!/usr/bin/env node

const args = process.argv.slice(2);

// Show help if no arguments or --help flag
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('My Tool - Description\n');
    console.log('Usage:');
    console.log('  mytool [options] [arguments]\n');
    console.log('Options:');
    console.log('  -h, --help     Show this help message');
    console.log('  -v, --version  Show version\n');
    console.log('Examples:');
    console.log('  mytool --help');
    process.exit(0);
}

// Your plugin logic here
console.log('Hello from my plugin!');
console.log('Arguments:', args);
```

## Interactive Mode Support

SlothTool can automatically detect if your plugin supports interactive mode and launch it accordingly.

### Declaring Interactive Support

Add a `slothtool` field to your `package.json`:

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "bin": {
    "mytool": "bin/my-tool.js"
  },
  "slothtool": {
    "interactive": true,
    "interactiveFlag": "-i"
  }
}
```

**Fields:**
- `interactive` (boolean): Set to `true` if your plugin supports interactive mode
- `interactiveFlag` (string): The flag to launch interactive mode (default: `-i`)

### Implementing Interactive Mode

```javascript
#!/usr/bin/env node

const prompts = require('prompts');

const args = process.argv.slice(2);

// Interactive mode
if (args.includes('--interactive') || args.includes('-i')) {
    interactiveMode();
    return;
}

// Show help by default
if (args.length === 0) {
    showHelp();
    process.exit(0);
}

// Regular command mode
// ... your logic here

async function interactiveMode() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: 'Please select an action:',
            choices: [
                { title: 'Option 1', value: 'option1' },
                { title: 'Option 2', value: 'option2' },
                { title: 'Exit', value: 'exit' }
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        // Handle actions
        if (response.action === 'option1') {
            console.log('Executing option 1...');
        }
    }
}

function showHelp() {
    console.log('My Tool - Description\n');
    console.log('Usage:');
    console.log('  mytool [options]\n');
    console.log('Options:');
    console.log('  -h, --help        Show this help message');
    console.log('  -i, --interactive Interactive mode\n');
}
```

### How It Works in SlothTool

When users run your plugin through `slothtool -i` → "Run plugin":

1. **If `slothtool.interactive` is `true`**: SlothTool automatically launches your plugin with the interactive flag
2. **If not declared**: SlothTool shows your help message first, then prompts the user to enter arguments

## Internationalization (i18n)

Your plugin can read the user's language preference from SlothTool's settings.

### Reading Language Settings

```javascript
const os = require('os');
const path = require('path');
const fs = require('fs');

function getLanguage() {
    try {
        const settingsPath = path.join(os.homedir(), '.slothtool', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return settings.language || 'zh';
        }
    } catch (error) {
        // Ignore errors, use default
    }
    return 'zh'; // Default to Chinese
}
```

### Implementing i18n

```javascript
const messages = {
    zh: {
        welcome: '欢迎使用我的工具',
        help: '帮助信息',
        // ... more messages
    },
    en: {
        welcome: 'Welcome to my tool',
        help: 'Help message',
        // ... more messages
    }
};

function t(key) {
    const lang = getLanguage();
    const langMessages = messages[lang] || messages.zh;
    return langMessages[key] || key;
}

// Usage
console.log(t('welcome'));
```

## Plugin Configuration

Plugins can store their own configuration in `~/.slothtool/plugin-configs/`.

### Example Configuration Module

```javascript
const os = require('os');
const path = require('path');
const fs = require('fs');

function getConfigPath(pluginName) {
    const configDir = path.join(os.homedir(), '.slothtool', 'plugin-configs');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    return path.join(configDir, `${pluginName}.json`);
}

function readConfig(pluginName, defaults = {}) {
    const configPath = getConfigPath(pluginName);

    if (!fs.existsSync(configPath)) {
        writeConfig(pluginName, defaults);
        return defaults;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        return defaults;
    }
}

function writeConfig(pluginName, config) {
    const configPath = getConfigPath(pluginName);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
    readConfig,
    writeConfig
};
```

### Usage

```javascript
const config = require('./lib/config');

// Read config with defaults
const myConfig = config.readConfig('mytool', {
    option1: true,
    option2: 'default value'
});

// Modify and save
myConfig.option1 = false;
config.writeConfig('mytool', myConfig);
```

## Best Practices

### 1. Default Behavior

**Always show help when no arguments are provided:**

```javascript
if (args.length === 0) {
    showHelp();
    process.exit(0);
}
```

This matches the behavior of standard CLI tools and SlothTool itself.

### 2. Help Flag

**Always support `--help` and `-h`:**

```javascript
if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}
```

### 3. Error Handling

**Provide clear error messages:**

```javascript
try {
    // Your logic
} catch (error) {
    console.error('Error:', error.message);
    console.log('\nRun "mytool --help" for usage information.');
    process.exit(1);
}
```

### 4. Exit Codes

**Use appropriate exit codes:**

- `0`: Success
- `1`: General error
- `2`: Misuse of command

### 5. User Input Validation

**Validate user input:**

```javascript
const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'Enter a value:',
    validate: value => value.length > 0 ? true : 'Value is required'
});
```

### 6. Dependencies

**Keep dependencies minimal:**

Only include necessary dependencies. For interactive prompts, `prompts` is recommended as it's lightweight and user-friendly.

## Publishing Your Plugin

### 1. Prepare for Publishing

```bash
# Update version
npm version patch  # or minor, major

# Test locally first
npm link
slothtool install @yourscope/plugin-mytool
slothtool mytool --help
```

### 2. Publish to npm

```bash
# Login to npm (first time only)
npm login

# Publish
npm publish --access public
```

### 3. Verify Publication

```bash
# Unlink local version
npm unlink -g @yourscope/plugin-mytool

# Install from npm
slothtool install @yourscope/plugin-mytool
slothtool mytool --help
```

## Adding to Official Plugin List

If you want your plugin to appear in SlothTool's official plugin list (accessible via `slothtool -i` → "Install official plugin"):

### 1. Fork the Repository

Fork the [SlothTool repository](https://github.com/yourusername/SlothTool) on GitHub.

### 2. Edit official-plugins.json

Edit `packages/slothtool/lib/official-plugins.json`:

```json
{
  "officialPlugins": [
    {
      "name": "@yourscope/plugin-mytool",
      "alias": "mytool",
      "description": "你的插件描述（中文）",
      "descriptionEn": "Your plugin description (English)",
      "version": "latest",
      "author": "Your Name",
      "features": [
        "功能1",
        "功能2",
        "功能3"
      ],
      "featuresEn": [
        "Feature 1",
        "Feature 2",
        "Feature 3"
      ]
    }
  ]
}
```

### 3. Submit Pull Request

1. Commit your changes
2. Push to your fork
3. Create a Pull Request to the main repository
4. Describe your plugin and its features

### 4. Requirements for Official Plugins

- Must be published to npm
- Must follow the plugin development guidelines
- Must have clear documentation
- Must support both Chinese and English (i18n)
- Must have a meaningful description and feature list

## Example: Complete Plugin

See `packages/plugin-loc` in the SlothTool repository for a complete example that includes:

- Interactive mode support
- Internationalization
- Configuration management
- Help system
- Multiple operation modes

## Need Help?

- Check the [SlothTool repository](https://github.com/yourusername/SlothTool)
- Review existing plugins in `packages/`
- Open an issue for questions or suggestions

---

Happy plugin development! 🐌
