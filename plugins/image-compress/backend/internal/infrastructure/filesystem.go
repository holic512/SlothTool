/**
 * @file AtomicFilesystem
 * @project SlothTool
 * @module Image Compress Plugin / Infrastructure
 * @description 封装输出文件存在性检查与原子写入，避免半写入和目录缺失问题。
 * @logic 1. 统一检查目标文件是否已存在；2. 在目标目录创建临时文件并写入；3. 关闭后原子重命名到最终路径。
 * @dependencies Standard Library: errors/os/path/filepath
 * @index_tags 原子写入, 文件存在检查, 输出目录, 临时文件, rename
 * @author holic512
 */

package infrastructure

import (
	"errors"
	"os"
	"path/filepath"
)

func FileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, err
}

func WriteFileAtomic(targetPath string, data []byte) (returnErr error) {
	targetDir := filepath.Dir(targetPath)
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}

	tempFile, err := os.CreateTemp(targetDir, ".image-compress-*")
	if err != nil {
		return err
	}

	tempPath := tempFile.Name()
	defer func() {
		if returnErr != nil {
			_ = os.Remove(tempPath)
		}
	}()

	if _, err := tempFile.Write(data); err != nil {
		_ = tempFile.Close()
		return err
	}
	if err := tempFile.Chmod(0o644); err != nil {
		_ = tempFile.Close()
		return err
	}
	if err := tempFile.Close(); err != nil {
		return err
	}
	if err := os.Rename(tempPath, targetPath); err != nil {
		return err
	}
	return nil
}
