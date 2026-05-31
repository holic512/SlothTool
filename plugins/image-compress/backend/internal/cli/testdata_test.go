/**
 * @file CliTestdataHelpers
 * @project SlothTool
 * @module Image Compress Plugin / CLI / Tests
 * @description 提供 CLI 测试对 WebP Base64 夹具的读取与落盘辅助，避免在测试内重复解析逻辑。
 * @logic 1. 从共享 testdata 目录读取 Base64 WebP；2. 解码后写入测试目录；3. 与 CLI 测试一起覆盖真实输入格式。
 * @dependencies Standard Library: bytes/encoding/base64/errors/os/path/filepath/runtime
 * @index_tags CLI测试夹具, webp, base64解码, 测试辅助
 * @author holic512
 */

package cli

import (
	"bytes"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

func writeWebPFixture(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	fixtureBytes, err := loadWebPFixture()
	if err != nil {
		return err
	}
	return os.WriteFile(path, fixtureBytes, 0o644)
}

func loadWebPFixture() ([]byte, error) {
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		return nil, errors.New("locate current file for fixture loading")
	}

	fixturePath := filepath.Join(filepath.Dir(currentFile), "..", "..", "testdata", "tiny.webp.base64")
	encodedFixture, err := os.ReadFile(fixturePath)
	if err != nil {
		return nil, err
	}

	decodedFixture := make([]byte, base64.StdEncoding.DecodedLen(len(encodedFixture)))
	written, err := base64.StdEncoding.Decode(decodedFixture, bytes.TrimSpace(encodedFixture))
	if err != nil {
		return nil, err
	}
	return decodedFixture[:written], nil
}
