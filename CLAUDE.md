# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SlothTool is a lightweight plugin management system for CLI tools. It allows users to install, manage, and run CLI tools
as plugins without polluting the global npm environment. Plugins are installed in `~/.slothtool/plugins/` and tracked in
a local registry at `~/.slothtool/registry.json`.

The system supports bilingual (Chinese/English) interface with user-configurable language settings stored in
`~/.slothtool/settings.json`.

## Monorepo Structure

This is an npm workspaces monorepo with two main packages:

- **packages/slothtool**: Core CLI tool that manages plugins
- **packages/plugin-loc**: Example plugin that counts lines of code with interactive features

Each package can be published independently to npm.

## Development Commands

### Setup

```bash
# Install all dependencies
npm install

# Link slothtool for local development
cd packages/slothtool
npm link
cd ../..

# Install plugin-loc dependencies
cd packages/plugin-loc
npm install
cd ../..
```

### Testing Locally

```bash
# Test the CLI
slothtool --help

# Configure language (default is Chinese)
slothtool config language en
slothtool config language zh

# Link and test a local plugin
cd packages/plugin-loc
npm link
cd ../..
slothtool install @holic512/plugin-loc

# Run the plugin in different modes
slothtool loc ./packages              # Count lines in directory
slothtool loc -v ./packages           # Verbose mode with file details
slothtool loc -i                      # Interactive mode
slothtool loc -c                      # Configure file type filtering
```

### Publishing

Each package is published independently:

```bash
cd packages/slothtool
npm publish --access public

cd packages/plugin-loc
npm publish --access public
```

## Architecture

### Core Components (slothtool)

**bin/slothtool.js**: Entry point that parses commands and dispatches to command handlers. Supports both explicit
commands (`slothtool run <plugin>`) and shorthand syntax (`slothtool <plugin>`). Includes i18n support.

**lib/registry.js**: Manages the plugin registry stored at `~/.slothtool/registry.json`. Provides functions to
read/write registry, add/remove plugins, and query installed plugins.

**lib/settings.js**: Manages user settings stored at `~/.slothtool/settings.json`. Handles language preference (
default: 'zh', options: 'zh' or 'en').

**lib/i18n.js**: Internationalization module providing bilingual support. Contains message translations for Chinese and
English. Uses settings.js to determine current language.

**lib/plugin-manager.js**: Handles plugin installation and uninstallation. Uses `npm install --prefix` to install
plugins into isolated directories under `~/.slothtool/plugins/<alias>/`. Extracts bin paths from package.json and stores
them in the registry. Includes i18n support for all user-facing messages.

**lib/commands/**: Command implementations for install, uninstall, list, run, and config operations. All commands
support i18n.

**lib/utils.js**: Utility functions for path resolution and plugin alias extraction. Converts package names like
`@holic512/plugin-loc` to aliases like `loc`. Provides paths for settings and registry files.

### Plugin Components (plugin-loc)

**bin/loc.js**: Interactive CLI entry point with multiple modes:

- Direct counting mode: `loc [directory]`
- Verbose mode: `loc -v [directory]`
- Interactive mode: `loc -i` (menu-driven interface)
- Config mode: `loc -c` (configure file type filtering)

**lib/counter.js**: Core counting logic that scans directories and counts lines. Supports file type filtering based on
configuration. Skips node_modules and hidden files/directories.

**lib/config.js**: Plugin-specific configuration management stored at `~/.slothtool/plugin-configs/loc.json`. Manages
file extension filtering with default support for common code file types (js, ts, py, java, etc.).

**lib/i18n.js**: Plugin-specific i18n module that reads language setting from slothtool's settings.json. Provides
translations for all plugin UI elements.

### Configuration System

**Global Settings** (`~/.slothtool/settings.json`):

- Language preference (zh/en)
- Shared across all slothtool operations

**Plugin Configs** (`~/.slothtool/plugin-configs/<plugin>.json`):

- Plugin-specific settings
- For loc plugin: file extension filtering
- Removed when plugin is uninstalled

### Plugin Execution Flow

1. User runs `slothtool <alias> [args]`
2. bin/slothtool.js routes to commands/run.js
3. run.js looks up the plugin in the registry
4. Spawns a child process with `node <binPath> [args]`
5. Inherits stdio to pass through output
6. Plugin reads language from global settings for i18n

### Plugin Installation Flow

1. User runs `slothtool install <package-name>`
2. Extract alias from package name (remove scope and `plugin-` prefix)
3. Check if already installed in registry
4. Create directory at `~/.slothtool/plugins/<alias>/`
5. Run `npm install <package-name> --prefix <plugin-dir>`
6. Read package.json to find bin path
7. Add plugin info to registry with name, version, binPath, and installedAt timestamp

### Interactive Features (plugin-loc)

The loc plugin provides an interactive mode (`loc -i`) with a menu system:

1. Count lines in current directory
2. Count lines in custom directory (with prompt)
3. Configure file type filtering (multiselect interface)
4. Exit

File type configuration uses the `prompts` library for CLI interaction with checkbox-style selection.

### Plugin Structure

Plugins are standard npm packages with a `bin` field in package.json. The bin field can be a string or object. SlothTool
extracts the first bin entry and stores its absolute path in the registry.

Plugins can optionally:

- Read language settings from `~/.slothtool/settings.json` for i18n
- Store plugin-specific config in `~/.slothtool/plugin-configs/`
- Use interactive prompts for enhanced UX

## Key Design Decisions

- **No global pollution**: Plugins install to `~/.slothtool/plugins/` instead of global npm
- **Alias extraction**: Package names are normalized to simple aliases (e.g., `@holic512/plugin-loc` → `loc`)
- **Isolated dependencies**: Each plugin has its own node_modules directory
- **Registry-based tracking**: Local JSON file tracks installed plugins and their bin paths
- **Shorthand syntax**: Users can run `slothtool <plugin>` instead of `slothtool run <plugin>`
- **Bilingual support**: Default Chinese with English option, configurable via `slothtool config language <lang>`
- **Plugin-specific configs**: Stored separately from global settings, can be managed independently
- **Interactive UX**: Plugins can provide menu-driven interfaces for better user experience
