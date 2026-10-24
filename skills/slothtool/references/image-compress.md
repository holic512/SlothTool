# image-compress：保留源图的独立输出

默认选择与输入不同、位于输入目录树外的新输出目录，不覆盖源图或已有结果。用户指定输出时先检查其是否指向原文件；覆盖、替换须有明确授权。不要擅自加 `--overwrite` 或 `--allow-larger`。

**所有选项都放在输入路径之前**：Node 包装器原样转发参数，Go `flag` 在首个位置参数处停止解析；帮助文本中部分“路径后加选项”的示例不能作为参数顺序依据。

```sh
slothtool image-compress --help
slothtool image-compress --output-dir ./compressed-new --dry-run --json ./photo.jpg
slothtool image-compress --output-dir ./compressed-new --json ./photo.jpg
slothtool image-compress --recursive --output-dir ./compressed-album-new --quality 82 --max-width 1920 --dry-run --json ./album
slothtool image-compress --recursive --output-dir ./compressed-album-new --quality 82 --max-width 1920 --json ./album
```

示例质量和宽度并非强制默认，保留用户指定参数。预览会进行压缩计算但不写图片；确认预览没有意外覆盖/失败后再执行实际写入。

- `--quality`：JPEG 质量 1–100，默认 82；不要承诺对所有格式均有同样效果。
- `--max-width`、`--max-height`：限制尺寸，0 表示保留原尺寸上限设置。
- `--concurrency`：并发数量；0 使用后端默认。
- `--recursive` / `-r`：递归目录；`--output-dir` / `-o`：输出目录。
- 默认只写更小结果；较大结果可能跳过，不能把跳过解释成成功生成。
- `--overwrite` 在没有输出目录时可替换源文件，在输出目录模式可替换已有目标；不得仅为排除“已存在”错误而自动添加。

读取 JSON 中的逐文件结果和汇总，报告成功、跳过、失败、节省大小及实际输出。非零退出或部分失败要如实说明；不要删除源文件。若已安装包的后端缺失或平台不支持，报告问题，不自动安装 Go 或编译替代后端。

源码核对位置：`plugins/image-compress/bin/image-compress.js`、`plugins/image-compress/lib/service.js`、`plugins/image-compress/backend/internal/cli/app.go`。
