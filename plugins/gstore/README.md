# gstore

`gstore` syncs SlothTool personal data through a GitHub private repository. It uses the local `git` and `gh` commands and never stores a GitHub token.

## Usage

```bash
gstore auth
gstore repo set holic512/my-private-data --create
gstore bind todo default ~/.slothtool/data/todo/default
gstore sync todo default
```

`gstore auth` uses GitHub CLI's device login. It prints a GitHub login URL and a one-time code, waits for you to finish authorization in your browser, and does not open the browser automatically.

Run `gstore` with no arguments to open the TUI.
