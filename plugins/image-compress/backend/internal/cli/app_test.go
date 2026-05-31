/**
 * @file ImageCompressCliAppTest
 * @project SlothTool
 * @module Image Compress Plugin / CLI / Tests
 * @description 覆盖命令行帮助、真实后端 dry-run、JSON 输出和非法参数退出码，确认 CLI 封装可直接使用。
 * @logic 1. 验证帮助与参数错误输出；2. 使用真实图片夹具跑 dry-run 与 JSON 模式；3. 验证退出码与输出文件副作用。
 * @dependencies CLI: ./app.go, Standard Library: bytes/encoding/json/image/image/color/image/jpeg/os/path/filepath/strings/testing
 * @index_tags CLI测试, 干跑, JSON输出, 帮助信息, 退出码
 * @author holic512
 */

package cli

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAppHelpOutputsUsage(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	app := NewApp(&stdout, &stderr)

	exitCode := app.Run(t.Context(), []string{"--help"})
	if exitCode != 0 {
		t.Fatalf("expected help exit code 0, got %d", exitCode)
	}
	if !strings.Contains(stdout.String(), "Usage:") {
		t.Fatalf("expected help output to contain Usage, got %q", stdout.String())
	}
	if stderr.Len() != 0 {
		t.Fatalf("expected empty stderr for help, got %q", stderr.String())
	}
}

func TestAppDryRunUsesBackendWithoutWritingFiles(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPath := filepath.Join(tempDir, "photo.jpg")
	if err := writeJPEGFixture(inputPath, 240, 160, 100); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	app := NewApp(&stdout, &stderr)

	exitCode := app.Run(t.Context(), []string{"--dry-run", "--quiet", inputPath})
	if exitCode != 0 {
		t.Fatalf("expected exit code 0, got %d, stderr=%q", exitCode, stderr.String())
	}
	if !strings.Contains(stdout.String(), "DRY-RUN") {
		t.Fatalf("expected DRY-RUN output, got %q", stdout.String())
	}

	outputPath := filepath.Join(tempDir, "photo.compressed.jpg")
	if _, err := os.Stat(outputPath); !os.IsNotExist(err) {
		t.Fatalf("expected dry-run not to create output file, stat err=%v", err)
	}
}

func TestAppJSONOutputsSummaryForWebPSkip(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPath := filepath.Join(tempDir, "tiny.webp")
	if err := writeWebPFixture(inputPath); err != nil {
		t.Fatalf("write webp fixture: %v", err)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	app := NewApp(&stdout, &stderr)

	exitCode := app.Run(t.Context(), []string{"--json", inputPath})
	if exitCode != 0 {
		t.Fatalf("expected exit code 0 for controlled skip, got %d, stderr=%q", exitCode, stderr.String())
	}

	var summary struct {
		SkippedCount int `json:"SkippedCount"`
		Results      []struct {
			Status string `json:"Status"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(stdout.Bytes(), &summary); err != nil {
		t.Fatalf("decode json output: %v; output=%q", err, stdout.String())
	}
	if summary.SkippedCount != 1 {
		t.Fatalf("expected skipped count 1, got %d", summary.SkippedCount)
	}
	if len(summary.Results) != 1 || summary.Results[0].Status != "skipped_unsupported_output" {
		t.Fatalf("expected unsupported output skip in json summary, got %+v", summary.Results)
	}
}

func TestAppReturnsUsageErrorForInvalidArgs(t *testing.T) {
	t.Parallel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	app := NewApp(&stdout, &stderr)

	exitCode := app.Run(t.Context(), []string{"--quality", "101"})
	if exitCode != 2 {
		t.Fatalf("expected usage exit code 2, got %d", exitCode)
	}
	if !strings.Contains(stderr.String(), "at least one input path is required") {
		t.Fatalf("expected missing-input error, got %q", stderr.String())
	}
}

func writeJPEGFixture(path string, width int, height int, quality int) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	imageFixture := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			imageFixture.Set(x, y, color.NRGBA{
				R: uint8((x * 7) % 255),
				G: uint8((y * 5) % 255),
				B: uint8((x + y) % 255),
				A: 255,
			})
		}
	}

	return jpeg.Encode(file, imageFixture, &jpeg.Options{Quality: quality})
}
