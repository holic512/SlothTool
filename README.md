# SlothTool

🐌 A plugin manager and dispatcher for CLI tools.

SlothTool is a lightweight plugin management system that allows you to install, manage, and run CLI tools as plugins without polluting your global npm environment.

## Features

- **Zero Global Pollution**: Plugins are installed in `~/.slothtool/plugins/`, not globally
- **Simple Commands**: Easy-to-use CLI with intuitive commands
- **Plugin Isolation**: Each plugin has its own dependencies
- **Shorthand Syntax**: Run plugins with `slothtool <plugin>` instead of `slothtool run <plugin>`
- **Monorepo Structure**: Official plugins maintained in the same repository
- **Independent Publishing**: Each plugin can be published independently

## Installation

```bash
npm install -g slothtool
```

## Usage

### Install a Plugin

```bash
slothtool install @holic512/plugin-loc
```

### List Installed Plugins

```bash
slothtool list
```

### Run a Plugin

```bash
# Full syntax
slothtool run loc ./src

# Shorthand syntax (recommended)
slothtool loc ./src
```

### Uninstall a Plugin

```bash
slothtool uninstall loc
```

### Get Help

```bash
slothtool --help
```

## Official Plugins

### @holic512/plugin-loc

Count lines of code in a directory.

```bash
slothtool install @holic512/plugin-loc
slothtool loc ./src
slothtool loc --verbose ./src
```

## Creating Your Own Plugin

A SlothTool plugin is simply an npm package with a `bin` field in its `package.json`.

### Example Plugin Structure

```
my-plugin/
├── package.json
├── bin/
│   └── my-tool.js
└── lib/
    └── index.js
```

### package.json

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "bin": {
    "mytool": "bin/my-tool.js"
  }
}
```

### bin/my-tool.js

```javascript
#!/usr/bin/env node

console.log('Hello from my plugin!');
```

### Publishing Your Plugin

1. Publish to npm:
   ```bash
   npm publish --access public
   ```

2. Users can install it:
   ```bash
   slothtool install @yourscope/plugin-mytool
   ```

3. Users can run it:
   ```bash
   slothtool mytool
   ```

## Development

This project uses npm workspaces for monorepo management.

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/SlothTool.git
cd SlothTool

# Install dependencies
npm install

# Link slothtool for local development
cd packages/slothtool
npm link
```

### Testing Locally

```bash
# Test the CLI
slothtool --help

# Test installing the local plugin
cd packages/plugin-loc
npm link
cd ../..
slothtool install @holic512/plugin-loc

# Test running the plugin
slothtool loc ./packages
```

## Architecture

- **slothtool**: Core CLI tool that manages plugins
- **Plugins**: Independent npm packages with CLI executables
- **Registry**: Local JSON file (`~/.slothtool/registry.json`) tracking installed plugins
- **Plugin Storage**: `~/.slothtool/plugins/` directory containing plugin installations

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
