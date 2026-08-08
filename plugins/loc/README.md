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
- 宽终端使用操作 / 详情双栏，窄终端自动改为上下堆叠，低高度终端切换为单面板摘要
- 统计结果按文件数、总行数、平均行数、扩展名分布和热点文件分层展示
- 扩展名与排除目录页面展示选中规则的状态、匹配范围和配置启用比例
- 配置列表按终端高度动态分页，保留 `[` / `]` 跨页与 Space 切换操作
- 自定义目录输入支持粘贴带引号路径和带反斜杠空格的路径
- 显式 CLI 统计目录和详细文件清单
- 文件扩展名过滤
- 排除目录配置
- 读写错误以 warning 形式汇总，不中断整体扫描
