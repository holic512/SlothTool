/**
 * @file ImageCompressMain
 * @project SlothTool
 * @module Image Compress Plugin / CLI Entry
 * @description 提供图片压缩命令的可执行入口，仅负责连接标准输入输出与 CLI 应用层。
 * @logic 1. 创建 CLI App；2. 传入进程参数；3. 将应用返回的退出码映射到进程退出。
 * @dependencies CLI: ../../internal/cli, Standard Library: context/os
 * @index_tags 命令入口, main, image-compress, CLI启动
 * @author holic512
 */

package main

import (
	"context"
	"os"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/cli"
)

func main() {
	app := cli.NewApp(os.Stdout, os.Stderr)
	os.Exit(app.Run(context.Background(), os.Args[1:]))
}
