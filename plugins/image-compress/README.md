# Image Compress Plugin Workspace

`plugins/image-compress/` 是 SlothTool 的官方图片压缩插件工作区。

插件使用纯 Go 后端处理图片，通过 Node CLI 保持 SlothTool 插件契约，并提供默认全屏 Ink TUI。

当前已提供：

- `pkg/compress` 稳定后端 API
- `cmd/image-compress` 可执行 CLI
- `bin/image-compress.js` 默认 TUI / 显式 CLI 入口
- `lib/tui.js` 响应式全屏 Ink 工作台，支持拖拽文件或文件夹路径
- 输入队列、执行方案、压缩收益、失败文件和当前会话历史
- 宽屏双栏、窄屏纵向工作流、低高度精简结果和极小终端提示
- 选项动态分页、当前参数解释，以及预演/实际写入的高对比状态
- `.github/workflows/release-image-compress.yml` 多平台 Go 资产打包与发布流程
- JPEG / PNG 压缩输出
- WebP 输入解析与受控跳过
- `go test ./...` 回归测试
- `node --test test/image-compress-plugin.test.js` 插件烟雾测试

当前交互形态：

- 直接执行 `node plugins/image-compress/bin/image-compress.js` 默认进入全屏 TUI
- 在 TUI 的运行页可直接把文件或文件夹拖进终端，按输入队列批量处理
- 结果会区分成功、跳过、失败、实际节省和预演预计节省，并优先展示异常或高收益文件
- 选项页根据终端高度分页，展示 JPEG 质量、尺寸、递归、覆盖、预演和并发等参数的实际作用
- 显式传参时走 CLI 并转发给 Go 后端

快速体验：

```bash
node plugins/image-compress/bin/image-compress.js --help
node plugins/image-compress/bin/image-compress.js
node plugins/image-compress/bin/image-compress.js ./photo.jpg --dry-run

cd plugins/image-compress/backend
go run ./cmd/image-compress --help
go run ./cmd/image-compress ./photo.jpg
go run ./cmd/image-compress -r ./album --output-dir ./compressed
go run ./cmd/image-compress ./banner.png --max-width 1280 --max-height 720
go run ./cmd/image-compress ./photo.jpg --dry-run --json
```

说明：

- 发布资产内如果存在 `backend/dist/image-compress-backend`（Windows 为 `.exe`），Node 包装层会优先执行该预编译二进制。
- 只有在源码工作区且未找到预编译二进制时，Node 包装层才会回退到 `go run ./cmd/image-compress`，因此本地开发仍需要可用的 Go 工具链。
- TUI 内拖拽文件本质上依赖终端把路径文本粘贴到当前进程；Ink 侧已用粘贴钩子接住并解析带空格、引号和反斜杠转义的路径。
