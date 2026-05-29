# Plugin Development Guide

This repository keeps one official plugin package, `plugins/loc`, plus one scaffold directory, `plugins/template-basic`.

## Quick Start

Create a new plugin from the scaffold:

```bash
cp -R plugins/template-basic my-plugin
cd my-plugin
```

Then update:

- `package.json` name, description, and `bin`
- `bin/mytool.js`
- `lib/i18n.js`
- `lib/config.js`
- `lib/interactive.js`

## Current Reference Package

Use `plugins/loc` as the production reference for:

- CLI argument parsing
- interactive mode
- plugin config storage
- bilingual output

## Minimum Requirements

Your plugin should have:

1. `package.json`
2. a `bin` field
3. a Node.js executable entry file starting with `#!/usr/bin/env node`
4. optional `slothtool.interactive` metadata if interactive mode is supported

Example:

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "bin": {
    "mytool": "bin/mytool.js"
  },
  "slothtool": {
    "interactive": true,
    "interactiveFlag": "-i"
  }
}
```

## Directory Conventions

Recommended layout:

```text
my-plugin/
├── bin/
│   └── mytool.js
├── lib/
│   ├── config.js
│   ├── i18n.js
│   └── interactive.js
├── README.md
└── package.json
```

## Local Development

For fast iteration, run your plugin directly:

```bash
node bin/mytool.js --help
```

For `loc`, use:

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
```

## SlothTool Integration

SlothTool currently installs only built-in official plugins from GitHub Release assets. That means:

- `slothtool install loc` works because `loc` is in `lib/official-plugins.json`
- arbitrary third-party plugin install is not part of the current product scope

If the repository adds another official plugin in the future, the implementer must update:

- `lib/official-plugins.json`
- `.github/workflows/release-plugins.yml`
- user documentation

## i18n

Plugins can read the language setting from:

```text
~/.slothtool/settings.json
```

The simplest pattern is to follow `plugins/loc/lib/i18n.js`.

## Plugin Configuration

Plugin-specific settings should live under:

```text
~/.slothtool/plugin-configs/<alias>.json
```

The simplest pattern is to follow `plugins/loc/lib/config.js`.

## Publishing Model In This Repo

- Root package `@holic512/slothtool` is published from the repository root.
- Official plugin `@holic512/plugin-loc` is released from `plugins/loc` as a GitHub Release asset using `npm pack`.
- `plugins/template-basic` is not published.

## References

- `plugins/loc`
- `plugins/template-basic`
- `README.md`
- `LOCAL_BUILD_GUIDE.md`
