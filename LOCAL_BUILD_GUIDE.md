# Local Build & Development Guide

This repository is now centered around a root package plus one plugin workspace.

## Repository Layout

```text
SlothTool/
├── bin/                     # Root CLI entry for @holic512/slothtool
├── lib/                     # Root core logic
├── plugins/
│   ├── loc/                 # Official plugin workspace
│   └── template-basic/      # Scaffold only, not published
├── package.json
└── package-lock.json
```

## Prerequisites

- Node.js >= 14
- npm >= 7
- Git

## Install Dependencies

```bash
npm install
```

This installs the root package dependencies and the `plugins/loc` workspace dependency tree.

## Link SlothTool Locally

```bash
npm link
```

After linking:

```bash
slothtool --help
slothtool -i
```

## Develop The Core CLI

Core files now live at the repository root:

- `bin/slothtool.js`
- `lib/plugin-manager.js`
- `lib/commands/*`

Typical loop:

```bash
vim lib/i18n.js
slothtool --help
```

There is no build step for the core CLI.

## Develop The `loc` Plugin

Because official plugin installation now targets GitHub Release assets, the fastest local iteration path is direct execution:

```bash
node plugins/loc/bin/loc.js --help
node plugins/loc/bin/loc.js .
node plugins/loc/bin/loc.js -i
```

Common edit loop:

```bash
vim plugins/loc/lib/counter.js
node plugins/loc/bin/loc.js ./src
```

## Test The Managed CLI

Useful checks:

```bash
node --check bin/slothtool.js
node --check lib/plugin-manager.js
node --check plugins/loc/bin/loc.js

node bin/slothtool.js --help
node bin/slothtool.js install invalid-alias
node plugins/loc/bin/loc.js --help
```

## Package Validation

Root package:

```bash
npm pack --dry-run
```

Plugin package:

```bash
cd plugins/loc
npm pack --dry-run
```

## Release Model

### Core Package

- published from the repository root
- workflow: `.github/workflows/release-core.yml`

### Official Plugin

- source: `plugins/loc`
- output: GitHub Release `.tgz` asset
- workflow: `.github/workflows/release-plugins.yml`

## Template Usage

Create a new scaffold:

```bash
cp -R plugins/template-basic my-plugin
```

`plugins/template-basic` is not a workspace package and is not part of release automation.
