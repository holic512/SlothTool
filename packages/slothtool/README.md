# SlothTool

🐌 A plugin manager and dispatcher for CLI tools.

## Installation

```bash
npm install -g slothtool
```

## Usage

```bash
# Install a plugin
slothtool install @slothtool/plugin-loc

# List installed plugins
slothtool list

# Run a plugin
slothtool loc ./src

# Uninstall a plugin
slothtool uninstall loc

# Get help
slothtool --help
```

## Commands

- `slothtool install <plugin>` - Install a plugin from npm
- `slothtool uninstall <plugin>` - Uninstall a plugin
- `slothtool list` - List all installed plugins
- `slothtool run <plugin> [args]` - Run a plugin with arguments
- `slothtool <plugin> [args]` - Shorthand for running a plugin

## Features

- **Zero Global Pollution**: Plugins are installed in `~/.slothtool/plugins/`
- **Plugin Isolation**: Each plugin has its own dependencies
- **Simple CLI**: Easy-to-use commands
- **Shorthand Syntax**: Run plugins directly with `slothtool <plugin>`

## How It Works

SlothTool manages CLI tools as plugins:

1. Plugins are npm packages with a `bin` field
2. When you install a plugin, it's downloaded to `~/.slothtool/plugins/`
3. SlothTool maintains a registry at `~/.slothtool/registry.json`
4. When you run a plugin, SlothTool spawns the plugin's executable

## Official Plugins

- [@holic512/plugin-loc](../plugin-loc) - Count lines of code

## Creating Plugins

Any npm package with a `bin` field can be a SlothTool plugin:

```json
{
  "name": "@yourscope/plugin-mytool",
  "version": "1.0.0",
  "bin": {
    "mytool": "bin/my-tool.js"
  }
}
```

Publish to npm and users can install it:

```bash
slothtool install @yourscope/plugin-mytool
slothtool mytool
```

## License

ISC
