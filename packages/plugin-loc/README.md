# @holic512/plugin-loc

Count lines of code in a directory.

## Installation

```bash
slothtool install @holic512/plugin-loc
```

## Usage

```bash
# Count lines in current directory
slothtool loc

# Count lines in a specific directory
slothtool loc ./src

# Show detailed file information
slothtool loc --verbose ./src
slothtool loc -v ./src

# Get help
slothtool loc --help
```

## Features

- Recursively scans directories
- Automatically skips `node_modules` and hidden files/directories
- Handles errors gracefully (skips unreadable files)
- Supports verbose mode to show per-file statistics

## Output

```
Counting lines of code in: /path/to/directory

Total files: 42
Total lines: 1337
```

With `--verbose`:

```
Counting lines of code in: /path/to/directory

Files:

  /path/to/file1.js: 120 lines
  /path/to/file2.js: 85 lines
  ...

Total files: 42
Total lines: 1337
```

## What Gets Counted

- All files in the target directory and subdirectories
- Excludes `node_modules/`
- Excludes hidden files and directories (starting with `.`)
- Skips binary files that can't be read as text

## License

ISC
