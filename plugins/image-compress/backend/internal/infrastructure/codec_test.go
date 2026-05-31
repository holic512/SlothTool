/**
 * @file ImageCodecTest
 * @project SlothTool
 * @module Image Compress Plugin / Infrastructure / Tests
 * @description 覆盖元数据剥离与缩放规则，确保纯 Go 编解码层满足默认安全策略。
 * @logic 1. 构造含伪 EXIF 的 JPEG 并验证重编码后元数据被剥离；2. 验证缩放函数不会放大原图。
 * @dependencies Infrastructure: ./codec.go, Standard Library: bytes/image/image/color/image/jpeg/os/path/filepath/testing
 * @index_tags 编解码测试, EXIF剥离, 不放大, 缩放规则
 * @author holic512
 */

package infrastructure

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestEncodeStripsMetadataFromJPEG(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	inputPath := filepath.Join(tempDir, "source.jpg")

	imageBuffer := bytes.Buffer{}
	sourceImage := image.NewNRGBA(image.Rect(0, 0, 32, 32))
	for y := 0; y < 32; y++ {
		for x := 0; x < 32; x++ {
			sourceImage.Set(x, y, color.NRGBA{R: uint8(x * 8), G: uint8(y * 8), B: 160, A: 255})
		}
	}
	if err := jpeg.Encode(&imageBuffer, sourceImage, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatalf("encode fixture jpeg: %v", err)
	}

	withExif := injectFakeExif(imageBuffer.Bytes())
	if err := os.WriteFile(inputPath, withExif, 0o644); err != nil {
		t.Fatalf("write jpeg fixture: %v", err)
	}
	if !bytes.Contains(withExif, []byte("Exif\x00\x00unit-test")) {
		t.Fatalf("expected injected fixture to contain fake exif segment")
	}

	decodedImage, err := DecodeFile(inputPath)
	if err != nil {
		t.Fatalf("DecodeFile returned error: %v", err)
	}

	encodedBytes, err := Encode("jpeg", decodedImage.Image, 80)
	if err != nil {
		t.Fatalf("Encode returned error: %v", err)
	}
	if bytes.Contains(encodedBytes, []byte("Exif\x00\x00unit-test")) {
		t.Fatalf("expected re-encoded jpeg to strip fake exif metadata")
	}
}

func TestResizeDoesNotEnlargeImages(t *testing.T) {
	t.Parallel()

	sourceImage := image.NewNRGBA(image.Rect(0, 0, 24, 12))
	resizedImage, width, height, changed := Resize(sourceImage, 120, 120)
	if changed {
		t.Fatalf("expected resize not to enlarge images")
	}
	if resizedImage.Bounds().Dx() != 24 || resizedImage.Bounds().Dy() != 12 {
		t.Fatalf("expected original bounds to be preserved, got %dx%d", resizedImage.Bounds().Dx(), resizedImage.Bounds().Dy())
	}
	if width != 24 || height != 12 {
		t.Fatalf("expected reported size 24x12, got %dx%d", width, height)
	}
}

func injectFakeExif(jpegBytes []byte) []byte {
	payload := []byte("Exif\x00\x00unit-test")
	length := len(payload) + 2
	segment := []byte{0xFF, 0xE1, byte(length >> 8), byte(length)}
	segment = append(segment, payload...)

	output := make([]byte, 0, len(jpegBytes)+len(segment))
	output = append(output, jpegBytes[:2]...)
	output = append(output, segment...)
	output = append(output, jpegBytes[2:]...)
	return output
}
