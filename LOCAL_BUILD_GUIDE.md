# Local Build & Development Guide

This guide will help you set up a local development environment for SlothTool and contribute to the project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Understanding the Project](#understanding-the-project)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Issues](#common-issues)
- [Publishing](#publishing)

## Prerequisites

### Required Knowledge

Before you start, you should understand:

1. **CLI Tools**: Command-line programs that run in the terminal (like `git`, `npm`)
2. **npm link**: Links local packages globally for development
3. **Monorepo**: A single repository containing multiple packages
4. **Node.js**: JavaScript runtime for executing `.js` files

### Required Software

- Node.js (v14 or higher)
- npm (v7 or higher, for workspaces support)
- Git

## Understanding the Project

### Key Differences from Web Projects

Unlike Vue/React projects with `npm run dev`, SlothTool is a **CLI tool**:

- **No build step**: Node.js directly executes `.js` files
- **No hot reload**: Changes take effect on next command execution
- **No dev server**: You test by running commands in the terminal
- **npm link**: Makes your local code globally available

### Project Structure

```
SlothTool/
├── packages/
│   ├── slothtool/              # Core CLI tool
│   │   ├── bin/                # Executable entry point
│   │   │   └── slothtool.js
│   │   ├── lib/                # Core logic
│   │   │   ├── commands/       # Command implementations
│   │   │   │   ├── install.js
│   │   │   │   ├── uninstall.js
│   │   │   │   ├── update.js
│   │   │   │   ├── update-all.js
│   │   │   │   ├── list.js
│   │   │   │   ├── run.js
│   │   │   │   ├── config.js
│   │   │   │   ├── interactive.js
│   │   │   │   └── index.js
│   │   │   ├── plugin-manager.js  # Plugin installation/management
│   │   │   ├── registry.js         # Plugin registry
│   │   │   ├── settings.js         # User settings
│   │   │   ├── utils.js            # Utility functions
│   │   │   ├── i18n.js             # Internationalization
│   │   │   └── official-plugins.json
│   │   └── package.json
│   │
│   └── plugin-loc/             # Example plugin
│       ├── bin/
│       │   └── loc.js          # Plugin entry point
│       ├── lib/
│       │   ├── counter.js      # Line counting logic
│       │   ├── config.js       # Plugin configuration
│       │   └── i18n.js         # Plugin i18n
│       └── package.json
│
├── package.json                # Root package.json (workspaces)
├── README.md                   # User documentation
├── PLUGIN_DEVELOPMENT.md       # Plugin development guide
└── LOCAL_BUILD_GUIDE.md        # This file
```

### Architecture Overview

**Core Components:**

- **slothtool**: Main CLI tool that manages plugins
- **Plugins**: Independent npm packages with CLI executables
- **Registry**: Local JSON file (`~/.slothtool/registry.json`) tracking installed plugins
- **Plugin Storage**: `~/.slothtool/plugins/` directory containing plugin installations
- **Settings**: `~/.slothtool/settings.json` storing global settings (language, etc.)
- **Plugin Configs**: `~/.slothtool/plugin-configs/` storing plugin-specific configurations

**How It Works:**

1. **Installing plugins**: Uses `npm install --prefix` to install plugins in isolated directories
2. **Running plugins**: Looks up plugin bin path from registry, spawns child process
3. **Language support**: All components read `settings.json` for current language
4. **Plugin configs**: Plugins can store their own configuration files

## Getting Started

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/yourusername/SlothTool.git
cd SlothTool

# Install all dependencies
npm install
```

**What happens:**

- npm reads root `package.json` and finds `workspaces: ["packages/*"]`
- Automatically installs dependencies for all packages in `packages/`
- Creates symlinks in `node_modules` for inter-package references

### Step 2: Link slothtool Globally

```bash
cd packages/slothtool
npm link
cd ../..
```

**What happens:**

- `npm link` creates a symbolic link in global npm directory pointing to your local code
- Now when you run `slothtool` in terminal, it executes your local `packages/slothtool/bin/slothtool.js`
- **This is the key to local development**: Changes to your code are immediately reflected

### Step 3: Verify Installation

```bash
# Test help command
slothtool --help

# Test language configuration
slothtool config language zh
slothtool config language en

# Check installed plugins (should be empty)
slothtool list

# Test interactive mode
slothtool -i
```

**Debugging tip:**

- If you modify any file in `packages/slothtool/`, just run `slothtool` again to see changes
- No need to rebuild or restart anything
- Node.js reads files fresh on each execution

### Step 4: Link and Test Plugin

#### Option A: Using npm link (Recommended)

```bash
# Link plugin globally
cd packages/plugin-loc
npm link
cd ../..

# Now you can run the plugin directly
loc --help
loc .
loc -i

# Or install it through slothtool
slothtool install @holic512/plugin-loc
slothtool loc ./src
```

**What happens:**

- `npm link` makes `loc` command globally available
- Changes to `packages/plugin-loc/` are immediately reflected
- You can test both standalone (`loc`) and through slothtool (`slothtool loc`)

#### Option B: Direct Execution (Quick Testing)

```bash
# Run plugin bin file directly
node packages/plugin-loc/bin/loc.js --help
node packages/plugin-loc/bin/loc.js .
node packages/plugin-loc/bin/loc.js -i
```

**Use cases:**

- Quick testing of specific features
- Don't want to pollute global commands
- Adding debug `console.log` statements

## Development Workflow

### Modifying Core Code

```bash
# 1. Edit a file
vim packages/slothtool/lib/i18n.js

# 2. Test immediately (no build needed)
slothtool --help

# 3. If there's a syntax error, you'll see it immediately
```

### Modifying Plugin Code

```bash
# 1. Edit plugin file
vim packages/plugin-loc/lib/counter.js

# 2. Test directly
slothtool loc ./src

# Or
node packages/plugin-loc/bin/loc.js ./src
```

### Adding a New Command

Example: Adding an `update` command to slothtool

```bash
# 1. Create command file
vim packages/slothtool/lib/commands/update.js

# 2. Export it in commands/index.js
vim packages/slothtool/lib/commands/index.js

# 3. Add command handler in bin/slothtool.js
vim packages/slothtool/bin/slothtool.js

# 4. Add i18n translations
vim packages/slothtool/lib/i18n.js

# 5. Test
slothtool update <plugin>
```

### Adding a New Feature to Plugin

Example: Adding verbose mode to plugin-loc

```bash
# 1. Modify counter logic
vim packages/plugin-loc/lib/counter.js

# 2. Update CLI argument parsing
vim packages/plugin-loc/bin/loc.js

# 3. Add i18n messages
vim packages/plugin-loc/lib/i18n.js

# 4. Test
slothtool loc -v ./src
```

## Testing

### Manual Testing Checklist

#### Core Functionality

```bash
# Language configuration
slothtool config language zh
slothtool config language en
slothtool config

# Plugin installation
slothtool install @holic512/plugin-loc
slothtool list

# Plugin execution
slothtool loc ./packages
slothtool loc -v ./packages
slothtool loc -i

# Plugin update
slothtool update loc
slothtool --update-all

# Plugin uninstallation
slothtool uninstall loc

# Interactive mode
slothtool -i
# Test all menu options

# Help
slothtool --help
slothtool -h
```

#### Plugin Testing

```bash
# Default behavior (should show help)
loc

# Help
loc --help
loc -h

# Basic usage
loc .
loc ./src

# Verbose mode
loc -v ./src

# Interactive mode
loc -i

# Configuration
loc -c
```

### Testing Complete Flow

```bash
# 1. Clean slate
rm -rf ~/.slothtool

# 2. Configure language
slothtool config language en

# 3. Install plugin
slothtool install @holic512/plugin-loc

# 4. Run plugin
slothtool loc ./packages

# 5. Test interactive mode
slothtool loc -i

# 6. Update plugin
slothtool update loc

# 7. Uninstall plugin
slothtool uninstall loc
```

## Debugging

### Using console.log

```javascript
// packages/slothtool/lib/plugin-manager.js
function installPlugin(packageName) {
    console.log('DEBUG: packageName =', packageName);
    const alias = extractPluginAlias(packageName);
    console.log('DEBUG: alias =', alias);
    // ...
}
```

Then run:

```bash
slothtool install @holic512/plugin-loc
```

### Using Node.js Debugger

```bash
# Built-in debugger
node inspect packages/slothtool/bin/slothtool.js install @holic512/plugin-loc

# Or use VS Code debugger
# Create .vscode/launch.json:
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug slothtool",
      "program": "${workspaceFolder}/packages/slothtool/bin/slothtool.js",
      "args": ["install", "@holic512/plugin-loc"]
    }
  ]
}
```

### Inspecting SlothTool Data

```bash
# View plugin directory
ls -la ~/.slothtool/plugins/

# View registry
cat ~/.slothtool/registry.json

# View settings
cat ~/.slothtool/settings.json

# View plugin configs
cat ~/.slothtool/plugin-configs/loc.json

# View all SlothTool data
tree ~/.slothtool
```

### Resetting Everything

```bash
# Remove all SlothTool data
rm -rf ~/.slothtool

# Unlink global commands (if needed)
cd packages/slothtool
npm unlink
cd ../plugin-loc
npm unlink
cd ../..
```

## Common Issues

### Q: Changes not taking effect?

**A:** Check these:

1. Did you run `npm link`?
2. Are there syntax errors? (Check terminal output)
3. If you modified `package.json`, re-run `npm link`
4. Clear cache: `rm -rf ~/.slothtool` and test again
5. Make sure you're not running a globally installed version: `which slothtool`

### Q: Command not found after npm link?

**A:**

```bash
# Check if link exists
ls -la $(npm root -g)/@holic512/slothtool

# Re-link
cd packages/slothtool
npm unlink
npm link
```

### Q: Plugin not found after installation?

**A:**

```bash
# Check registry
cat ~/.slothtool/registry.json

# Check plugin directory
ls -la ~/.slothtool/plugins/

# Try reinstalling
slothtool uninstall <plugin>
slothtool install <plugin>
```

### Q: npm link vs npm install?

**A:**

- `npm link`: Creates symbolic link to local code, changes take effect immediately (for development)
- `npm install`: Downloads and installs from npm registry (for production)

### Q: Why no build step?

**A:** This is a pure JavaScript project. Node.js directly executes `.js` files without compilation. If you were using TypeScript, you would need a build step.

### Q: How to test with different Node versions?

**A:**

```bash
# Using nvm
nvm install 14
nvm use 14
slothtool --help

nvm install 16
nvm use 16
slothtool --help
```

## Publishing

### Pre-publish Checklist

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Version number is bumped
- [ ] CHANGELOG is updated (if applicable)
- [ ] No debug code or console.logs
- [ ] Code is formatted and linted

### Publishing slothtool Core

```bash
cd packages/slothtool

# Update version
npm version patch  # or minor, major

# Publish
npm publish --access public

cd ../..
```

### Publishing a Plugin

```bash
cd packages/plugin-loc

# Update version
npm version patch

# Publish
npm publish --access public

cd ../..
```

### Version Guidelines

- **patch** (1.0.0 → 1.0.1): Bug fixes, minor changes
- **minor** (1.0.0 → 1.1.0): New features, backward compatible
- **major** (1.0.0 → 2.0.0): Breaking changes

### Post-publish Verification

```bash
# Unlink local version
cd packages/slothtool
npm unlink
cd ../..

# Install from npm
npm install -g @holic512/slothtool

# Test
slothtool --help
slothtool install @holic512/plugin-loc
slothtool loc ./src

# Re-link for development
cd packages/slothtool
npm link
cd ../..
```

## Contributing

### Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Create a Pull Request

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Code Style

- Use 4 spaces for indentation
- Use single quotes for strings
- Add comments for complex logic
- Keep functions small and focused
- Follow existing code patterns

## Need Help?

- Check existing code in `packages/` for examples
- Review the [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md)
- Open an issue on GitHub
- Read the [User Documentation](./README.md)

---

Happy coding! 🐌
