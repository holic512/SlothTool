/**
 * @file ImageCodec
 * @project SlothTool
 * @module Image Compress Plugin / Infrastructure
 * @description 提供 JPEG、PNG、WebP 的解码、纯 Go 缩放，以及 JPEG/PNG 编码能力。
 * @logic 1. 统一读取图片配置和像素数据；2. 使用 CatmullRom 在尺寸约束内缩放且不放大；3. 对 JPEG/PNG 执行纯 Go 编码并显式拒绝 WebP 输出。
 * @dependencies Standard Library: bytes/errors/image/image/jpeg/image/png/math/os, Third Party: golang.org/x/image/draw, golang.org/x/image/webp
 * @index_tags 图片编解码, webp解码, 缩放, jpeg编码, png编码
 * @author holic512
 */

package infrastructure

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"math"
	"os"
	"strings"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var (
	ErrUnsupportedInputFormat  = errors.New("unsupported input format")
	ErrUnsupportedOutputFormat = errors.New("unsupported output format")
)

type DecodedImage struct {
	Image  image.Image
	Format string
	Width  int
	Height int
}

func DecodeFile(path string) (DecodedImage, error) {
	configFile, err := os.Open(path)
	if err != nil {
		return DecodedImage{}, err
	}
	defer configFile.Close()

	config, configFormat, err := image.DecodeConfig(configFile)
	if err != nil {
		return DecodedImage{}, err
	}

	imageFile, err := os.Open(path)
	if err != nil {
		return DecodedImage{}, err
	}
	defer imageFile.Close()

	decodedImage, imageFormat, err := image.Decode(imageFile)
	if err != nil {
		return DecodedImage{}, err
	}

	format := normalizeFormat(imageFormat)
	if format == "" {
		format = normalizeFormat(configFormat)
	}
	if format == "" {
		return DecodedImage{}, ErrUnsupportedInputFormat
	}

	return DecodedImage{
		Image:  decodedImage,
		Format: format,
		Width:  config.Width,
		Height: config.Height,
	}, nil
}

func Resize(img image.Image, maxWidth int, maxHeight int) (image.Image, int, int, bool) {
	bounds := img.Bounds()
	sourceWidth := bounds.Dx()
	sourceHeight := bounds.Dy()

	targetWidth, targetHeight := fitWithin(sourceWidth, sourceHeight, maxWidth, maxHeight)
	if targetWidth == sourceWidth && targetHeight == sourceHeight {
		return img, sourceWidth, sourceHeight, false
	}

	destination := image.NewNRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	xdraw.CatmullRom.Scale(destination, destination.Bounds(), img, bounds, xdraw.Over, nil)
	return destination, targetWidth, targetHeight, true
}

func Encode(format string, img image.Image, quality int) ([]byte, error) {
	var buffer bytes.Buffer

	switch normalizeFormat(format) {
	case "jpeg":
		if err := jpeg.Encode(&buffer, img, &jpeg.Options{Quality: quality}); err != nil {
			return nil, err
		}
	case "png":
		encoder := png.Encoder{CompressionLevel: png.BestCompression}
		if err := encoder.Encode(&buffer, img); err != nil {
			return nil, err
		}
	case "webp":
		return nil, ErrUnsupportedOutputFormat
	default:
		return nil, ErrUnsupportedOutputFormat
	}

	return buffer.Bytes(), nil
}

func normalizeFormat(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "jpg", "jpeg":
		return "jpeg"
	case "png":
		return "png"
	case "webp":
		return "webp"
	default:
		return ""
	}
}

func fitWithin(width int, height int, maxWidth int, maxHeight int) (int, int) {
	if width <= 0 || height <= 0 {
		return width, height
	}

	scale := 1.0
	if maxWidth > 0 && width > maxWidth {
		scale = min(scale, float64(maxWidth)/float64(width))
	}
	if maxHeight > 0 && height > maxHeight {
		scale = min(scale, float64(maxHeight)/float64(height))
	}
	if scale >= 1.0 {
		return width, height
	}

	targetWidth := max(1, int(math.Round(float64(width)*scale)))
	targetHeight := max(1, int(math.Round(float64(height)*scale)))
	return targetWidth, targetHeight
}
