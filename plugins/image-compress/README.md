# Image Compress Plugin Workspace

`plugins/image-compress/` 是 SlothTool 未来图片压缩官方插件的预留工作区。

当前阶段实现了纯 Go 后端、Go CLI，以及一个遵循 SlothTool 插件契约的 Node CLI + Ink TUI 外壳。目录位于 `plugins/image-compress/`，目标是先把可复用的压缩核心、默认交互页和测试打稳。

当前已提供：

- `pkg/compress` 稳定后端 API
- `cmd/image-compress` 可执行 CLI
- `bin/image-compress.js` 默认 TUI / 显式 CLI 入口
- `lib/tui.js` 全屏 Ink 页面，支持拖拽文件或文件夹路径
- `.github/workflows/release-image-compress.yml` 多平台 Go 资产打包与发布流程
- JPEG / PNG 压缩输出
- WebP 输入解析与受控跳过
- `go test ./...` 回归测试
- `node --test test/image-compress-plugin.test.js` 插件烟雾测试

当前交互形态：

- 直接执行 `node plugins/image-compress/bin/image-compress.js` 默认进入全屏 TUI
- 在 TUI 的运行页可直接把文件或文件夹拖进终端，自动获取路径
- 显式传参时走 CLI 并转发给 Go 后端

本阶段仍明确不包含：

- SlothTool 根包 `workspaces` 接入
- `lib/official-plugins.json` 官方插件注册
- 发布工作流配置

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
