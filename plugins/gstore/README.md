# gstore

`gstore` syncs SlothTool settings, plugin configuration, and data through a GitHub private repository. It uses an isolated cache at `~/.slothtool/cache/gstore/repository`, calls the local `git` and `gh` commands, and never stores a GitHub token.

## Usage

```bash
gstore auth
gstore repo set holic512/my-private-data --create
gstore status
gstore sync
```

The default scopes are `settings.json`, `plugin-configs/` (excluding `gstore.json`), and `data/`. Machine-specific `registry.json`, installed plugins, and caches are not synced. Add extra directories with `gstore bind <tool> <name> <localDir>`.

Conflicts stop the operation by default. After reviewing them, resolve explicitly with `gstore sync --prefer-remote` or `gstore sync --prefer-local`.

`gstore auth` uses GitHub CLI's device login. It prints a GitHub login URL and a one-time code, waits for you to finish authorization in your browser, and does not open the browser automatically.

Run `gstore` with no arguments to open the TUI.
