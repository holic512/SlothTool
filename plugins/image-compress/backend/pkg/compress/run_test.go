/**
 * @file CompressionRunTest
 * @project SlothTool
 * @module Image Compress Plugin / Backend API / Tests
 * @description 通过公开 API 验证 JPEG/PNG 批处理、WebP 受控跳过和取消语义，确保未来 CLI/TUI 复用稳定。
 * @logic 1. 构造真实图片并验证压缩输出与尺寸结果；2. 验证 WebP 输入会被扫描并受控跳过；3. 验证取消时返回部分汇总和取消状态。
 * @dependencies API: ./run.go, Standard Library: bytes/context/encoding/base64/errors/image/image/color/image/jpeg/image/png/os/path/filepath/runtime/slices/testing
 * @index_tags 集成测试, jpeg压缩, png缩放, webp跳过, 取消测试
 * @author holic512
 */

package compress_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/pkg/compress"
)

func TestRunCompressesJPEGAndWritesOutput(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPath := filepath.Join(tempDir, "photo.jpg")
	if err := writeJPEGFixture(inputPath, 240, 160, 100); err != nil {
		t.Fatalf("write jpeg fixture: %v", err)
	}

	events := make([]compress.ProgressEvent, 0)
	summary, err := compress.Run(context.Background(), compress.CompressionRequest{
		InputPaths:  []string{inputPath},
		Quality:     45,
		Concurrency: 1,
	}, func(event compress.ProgressEvent) {
		events = append(events, event)
	})
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.SuccessCount != 1 {
		t.Fatalf("expected 1 success, got %d", summary.SuccessCount)
	}
	if len(summary.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(summary.Results))
	}

	result := summary.Results[0]
	if result.Status != compress.StatusSuccess {
		t.Fatalf("expected success status, got %s", result.Status)
	}
	if result.ResultBytes >= result.OriginalBytes {
		t.Fatalf("expected compressed jpeg to be smaller than source")
	}
	if _, err := os.Stat(result.OutputPath); err != nil {
		t.Fatalf("expected output file %q to exist: %v", result.OutputPath, err)
	}
	if !hasStage(events, compress.StageScan) || !hasStage(events, compress.StageDone) {
		t.Fatalf("expected scan and done events, got %+v", events)
	}
}

func TestRunScalesPNGAndPreservesRelativeOutputStructure(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputRoot := filepath.Join(tempDir, "input")
	outputRoot := filepath.Join(tempDir, "output")
	inputPath := filepath.Join(inputRoot, "nested", "banner.png")
	if err := os.MkdirAll(filepath.Dir(inputPath), 0o755); err != nil {
		t.Fatalf("mkdir fixture dir: %v", err)
	}
	if err := writePNGFixture(inputPath, 800, 480); err != nil {
		t.Fatalf("write png fixture: %v", err)
	}

	summary, err := compress.Run(context.Background(), compress.CompressionRequest{
		InputPaths:  []string{inputRoot},
		Recursive:   true,
		OutputDir:   outputRoot,
		MaxWidth:    40,
		MaxHeight:   40,
		Concurrency: 1,
	}, nil)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.SuccessCount != 1 {
		t.Fatalf("expected 1 success, got %d", summary.SuccessCount)
	}

	result := summary.Results[0]
	expectedOutput := filepath.Join(outputRoot, "nested", "banner.compressed.png")
	if result.OutputPath != expectedOutput {
		t.Fatalf("expected output path %q, got %q", expectedOutput, result.OutputPath)
	}
	if result.OutputWidth != 40 || result.OutputHeight != 24 {
		t.Fatalf("expected resized png to 40x24, got %dx%d", result.OutputWidth, result.OutputHeight)
	}
	if result.ResultBytes >= result.OriginalBytes {
		t.Fatalf("expected scaled png to be smaller than source")
	}
	if _, _, err := decodeConfig(result.OutputPath); err != nil {
		t.Fatalf("expected output png to decode: %v", err)
	}
}

func TestRunSkipsWebPOutputInDefaultMode(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPath := filepath.Join(tempDir, "tiny.webp")
	if err := writeWebPFixture(inputPath); err != nil {
		t.Fatalf("write webp fixture: %v", err)
	}

	summary, err := compress.Run(context.Background(), compress.CompressionRequest{
		InputPaths:  []string{inputPath},
		Concurrency: 1,
	}, nil)
	if err != nil {
		t.Fatalf("Run returned error: %v", err)
	}
	if summary.SkippedCount != 1 {
		t.Fatalf("expected 1 skipped result, got %d", summary.SkippedCount)
	}
	if summary.Results[0].Status != compress.StatusSkippedUnsupportedOutput {
		t.Fatalf("expected unsupported-output skip, got %s", summary.Results[0].Status)
	}
}

func TestRunReturnsPartialSummaryOnCancel(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPaths := make([]string, 0, 4)
	for index := 0; index < 4; index++ {
		path := filepath.Join(tempDir, "cancel-"+string(rune('a'+index))+".jpg")
		if err := writeJPEGFixture(path, 180, 120, 95); err != nil {
			t.Fatalf("write jpeg fixture %d: %v", index, err)
		}
		inputPaths = append(inputPaths, path)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	observerTriggered := false
	summary, err := compress.Run(ctx, compress.CompressionRequest{
		InputPaths:  inputPaths,
		Quality:     50,
		Concurrency: 1,
	}, func(event compress.ProgressEvent) {
		if !observerTriggered && event.Stage == compress.StageDecode {
			observerTriggered = true
			cancel()
		}
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
	if !summary.Cancelled {
		t.Fatalf("expected cancelled summary")
	}
	if summary.TotalFiles != 4 {
		t.Fatalf("expected total files 4, got %d", summary.TotalFiles)
	}
	if !hasStatus(summary.Results, compress.StatusCancelled) {
		t.Fatalf("expected at least one cancelled result, got %+v", summary.Results)
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

func writePNGFixture(path string, width int, height int) error {
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
				R: uint8((x*17 + y*3) % 255),
				G: uint8((x*7 + y*11) % 255),
				B: uint8((x*13 + y*5) % 255),
				A: 255,
			})
		}
	}

	return png.Encode(file, imageFixture)
}

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

func decodeConfig(path string) (int, int, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, err
	}
	return config.Width, config.Height, nil
}

func hasStage(events []compress.ProgressEvent, stage compress.Stage) bool {
	return slices.ContainsFunc(events, func(event compress.ProgressEvent) bool {
		return event.Stage == stage
	})
}

func hasStatus(results []compress.CompressionResult, status compress.ResultStatus) bool {
	return slices.ContainsFunc(results, func(result compress.CompressionResult) bool {
		return result.Status == status
	})
}

func TestFixtureBase64IsStable(t *testing.T) {
	t.Parallel()

	fixtureBytes, err := loadWebPFixture()
	if err != nil {
		t.Fatalf("loadWebPFixture returned error: %v", err)
	}
	if !strings.HasPrefix(string(fixtureBytes[:4]), "RIFF") {
		t.Fatalf("expected webp fixture to start with RIFF header")
	}
}
