# AGENTS.md

This file provides guidance to Codex when working with this repository.

## Project Overview

SlothTool is a lightweight CLI plugin manager.

- The root package is `@holic512/slothtool`
- The only official plugin kept in this repository is `@holic512/plugin-loc`
- Official plugins are installed through GitHub Release assets, not from npm package names entered by users

User data is stored under:

- `~/.slothtool/settings.json`
- `~/.slothtool/registry.json`
- `~/.slothtool/plugins/`
- `~/.slothtool/plugin-configs/`

## Repository Structure

```text
SlothTool/
├── bin/                     # Root CLI entry
├── lib/                     # Root core logic
├── plugins/
│   ├── loc/                 # Official plugin workspace
│   └── template-basic/      # Scaffold only
├── README.md
├── PLUGIN_DEVELOPMENT.md
├── LOCAL_BUILD_GUIDE.md
└── package.json
```

## Development Commands

### Setup

```bash
npm install
npm link
```

### Core Checks

```bash
slothtool --help
slothtool list
slothtool -i
node --check bin/slothtool.js
node --check lib/plugin-manager.js
```

### Plugin Checks

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
node plugins/loc/bin/loc.js -i
```

## Architecture

### Root CLI

- `bin/slothtool.js`: CLI entrypoint
- `lib/plugin-manager.js`: official plugin install/update/uninstall logic
- `lib/registry.js`: installed plugin registry
- `lib/settings.js`: language settings
- `lib/i18n.js`: SlothTool i18n
- `lib/commands/*`: CLI command handlers

### Official Plugin

- `plugins/loc/bin/loc.js`: plugin entrypoint
- `plugins/loc/lib/counter.js`: line counting logic
- `plugins/loc/lib/config.js`: loc-specific configuration
- `plugins/loc/lib/i18n.js`: loc-specific i18n

### Scaffold

- `plugins/template-basic/` is a copyable scaffold directory
- it is not published and not included in release automation

## Release Model

- Root package release workflow: `.github/workflows/release-core.yml`
- Plugin release workflow: `.github/workflows/release-plugins.yml`
- Official plugin catalog: `lib/official-plugins.json`

## Important Notes

- Do not reintroduce deleted plugin packages unless explicitly requested.
- Keep `slothtool install` restricted to built-in official aliases.
- Treat `plugins/template-basic` as scaffold-only, not a published package.
