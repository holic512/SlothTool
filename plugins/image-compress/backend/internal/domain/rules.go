/**
 * @file CompressionRules
 * @project SlothTool
 * @module Image Compress Plugin / Domain
 * @description 负责请求归一化、默认值应用、输出路径规划以及支持格式判断。
 * @logic 1. 校验并归一化请求参数；2. 基于输入根与输出策略规划目标路径；3. 统一图片格式与默认配置规则。
 * @dependencies Standard Library: fmt/path/filepath/runtime/strings
 * @index_tags 图片压缩规则, 请求校验, 输出路径, 默认值, 格式判断
 * @author holic512
 */

package domain

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
)

const defaultQuality = 82

func NormalizeRequest(req CompressionRequest) (NormalizedRequest, error) {
	if len(req.InputPaths) == 0 {
		return NormalizedRequest{}, fmt.Errorf("at least one input path is required")
	}

	quality := req.Quality
	if quality == 0 {
		quality = defaultQuality
	}
	if quality < 1 || quality > 100 {
		return NormalizedRequest{}, fmt.Errorf("quality must be between 1 and 100")
	}
	if req.MaxWidth < 0 || req.MaxHeight < 0 {
		return NormalizedRequest{}, fmt.Errorf("max width and max height must be zero or greater")
	}

	concurrency := req.Concurrency
	if concurrency == 0 {
		concurrency = defaultConcurrency()
	}
	if concurrency < 1 {
		return NormalizedRequest{}, fmt.Errorf("concurrency must be greater than 0")
	}

	onlyIfSmaller := true
	if req.OnlyIfSmaller != nil {
		onlyIfSmaller = *req.OnlyIfSmaller
	}

	inputPaths := make([]string, 0, len(req.InputPaths))
	seen := make(map[string]struct{}, len(req.InputPaths))
	for _, rawPath := range req.InputPaths {
		if strings.TrimSpace(rawPath) == "" {
			return NormalizedRequest{}, fmt.Errorf("input path must not be empty")
		}

		absolutePath, err := filepath.Abs(rawPath)
		if err != nil {
			return NormalizedRequest{}, fmt.Errorf("resolve input path %q: %w", rawPath, err)
		}
		absolutePath = filepath.Clean(absolutePath)

		if _, ok := seen[absolutePath]; ok {
			continue
		}
		seen[absolutePath] = struct{}{}
		inputPaths = append(inputPaths, absolutePath)
	}

	outputDir := ""
	if strings.TrimSpace(req.OutputDir) != "" {
		absoluteOutputDir, err := filepath.Abs(req.OutputDir)
		if err != nil {
			return NormalizedRequest{}, fmt.Errorf("resolve output directory %q: %w", req.OutputDir, err)
		}
		outputDir = filepath.Clean(absoluteOutputDir)
	}

	return NormalizedRequest{
		InputPaths:    inputPaths,
		Recursive:     req.Recursive,
		OutputDir:     outputDir,
		Overwrite:     req.Overwrite,
		OnlyIfSmaller: onlyIfSmaller,
		Quality:       quality,
		MaxWidth:      req.MaxWidth,
		MaxHeight:     req.MaxHeight,
		Concurrency:   concurrency,
		DryRun:        req.DryRun,
	}, nil
}

func IsSupportedInputExtension(path string) bool {
	_, ok := OutputFormatFromPath(path)
	return ok
}

func OutputFormatFromPath(path string) (string, bool) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		return "jpeg", true
	case ".png":
		return "png", true
	case ".webp":
		return "webp", true
	default:
		return "", false
	}
}

func PlanCandidate(req NormalizedRequest, inputPath string, sourceRoot string, explicitFile bool) (Candidate, error) {
	relativePath := filepath.Base(inputPath)
	if !explicitFile {
		var err error
		relativePath, err = filepath.Rel(sourceRoot, inputPath)
		if err != nil {
			return Candidate{}, fmt.Errorf("build relative path for %q: %w", inputPath, err)
		}
	}

	outputPath := plannedOutputPath(req, inputPath, relativePath)
	outputFormat, _ := OutputFormatFromPath(outputPath)

	return Candidate{
		InputPath:    inputPath,
		SourceRoot:   sourceRoot,
		RelativePath: filepath.Clean(relativePath),
		OutputPath:   filepath.Clean(outputPath),
		OutputFormat: outputFormat,
		ExplicitFile: explicitFile,
	}, nil
}

func defaultConcurrency() int {
	workers := runtime.GOMAXPROCS(0)
	if workers < 1 {
		return 1
	}
	if workers > 4 {
		return 4
	}
	return workers
}

func plannedOutputPath(req NormalizedRequest, inputPath string, relativePath string) string {
	if req.OutputDir == "" {
		if req.Overwrite {
			return inputPath
		}
		return filepath.Join(filepath.Dir(inputPath), compressedName(filepath.Base(inputPath)))
	}

	outputName := filepath.Base(relativePath)
	if !req.Overwrite {
		outputName = compressedName(outputName)
	}

	relativeDir := filepath.Dir(relativePath)
	if relativeDir == "." {
		return filepath.Join(req.OutputDir, outputName)
	}
	return filepath.Join(req.OutputDir, relativeDir, outputName)
}

func compressedName(fileName string) string {
	extension := filepath.Ext(fileName)
	baseName := strings.TrimSuffix(fileName, extension)
	return baseName + ".compressed" + extension
}
