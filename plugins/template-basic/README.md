# template-basic

This directory is a SlothTool plugin scaffold kept inside the repository.

## Purpose

- copy it when starting a new plugin
- align new plugins with current SlothTool conventions
- do not publish this directory directly

## Usage

```bash
cp -R plugins/template-basic my-plugin
cd my-plugin
```

Then update:

- `package.json`
- `bin/mytool.js`
- `lib/i18n.js`
- `lib/config.js`
- `lib/interactive.js`

## Notes

- The scaffold is JavaScript-based.
- It supports `slothtool.interactive`.
- It is not part of workspace publishing or GitHub Release automation.
