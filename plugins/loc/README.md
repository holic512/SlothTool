# @holic512/plugin-loc

`loc` 用于统计目录中的代码行数，默认以全屏 TUI 运行，也支持显式 CLI 统计与配置命令。

## Installation

```bash
slothtool install loc
```

## Usage

```bash
# 默认进入 loc TUI
slothtool loc
loc

# CLI 统计
slothtool loc .
loc ./src
loc -v ./src

# CLI 配置
loc --config
loc config show
loc config ext md off
loc config exclude dist on
loc config reset
```

## Features

- 默认全屏 TUI 入口
- 使用统一的插件 tab 头部与状态栏外壳
- 显式 CLI 统计目录和详细文件清单
- 文件扩展名过滤
- 排除目录配置
- 读写错误以 warning 形式汇总，不中断整体扫描
