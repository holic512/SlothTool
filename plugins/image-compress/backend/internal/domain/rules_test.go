/**
 * @file CompressionRulesTest
 * @project SlothTool
 * @module Image Compress Plugin / Domain / Tests
 * @description 覆盖请求归一化、默认值与输出路径规划规则，确保后续 CLI/TUI 复用时行为稳定。
 * @logic 1. 验证空输入、质量和并发参数校验；2. 验证默认值落地；3. 验证默认输出名与 outputDir 相对结构规划。
 * @dependencies Domain: ./rules.go, Standard Library: path/filepath/testing
 * @index_tags 领域测试, 请求校验, 输出路径测试, 默认值测试
 * @author holic512
 */

package domain

import (
	"path/filepath"
	"testing"
)

func TestNormalizeRequestRejectsInvalidValues(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		req  CompressionRequest
	}{
		{
			name: "empty input paths",
			req:  CompressionRequest{},
		},
		{
			name: "invalid quality",
			req: CompressionRequest{
				InputPaths: []string{"./image.jpg"},
				Quality:    101,
			},
		},
		{
			name: "invalid concurrency",
			req: CompressionRequest{
				InputPaths:  []string{"./image.jpg"},
				Concurrency: -1,
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			if _, err := NormalizeRequest(testCase.req); err == nil {
				t.Fatalf("expected NormalizeRequest to fail for %s", testCase.name)
			}
		})
	}
}

func TestNormalizeRequestAppliesDefaults(t *testing.T) {
	t.Parallel()

	normalizedRequest, err := NormalizeRequest(CompressionRequest{
		InputPaths: []string{"./image.jpg"},
	})
	if err != nil {
		t.Fatalf("NormalizeRequest returned error: %v", err)
	}

	if !normalizedRequest.OnlyIfSmaller {
		t.Fatalf("expected OnlyIfSmaller default to true")
	}
	if normalizedRequest.Quality != defaultQuality {
		t.Fatalf("expected default quality %d, got %d", defaultQuality, normalizedRequest.Quality)
	}
	if normalizedRequest.Concurrency < 1 {
		t.Fatalf("expected concurrency default greater than 0, got %d", normalizedRequest.Concurrency)
	}
}

func TestPlanCandidateBuildsExpectedOutputPaths(t *testing.T) {
	t.Parallel()

	inputRoot := filepath.Join(string(filepath.Separator), "tmp", "images")
	inputFile := filepath.Join(inputRoot, "nested", "photo.jpg")

	defaultCandidate, err := PlanCandidate(NormalizedRequest{}, inputFile, inputRoot, false)
	if err != nil {
		t.Fatalf("PlanCandidate returned error: %v", err)
	}
	expectedDefault := filepath.Join(inputRoot, "nested", "photo.compressed.jpg")
	if defaultCandidate.OutputPath != expectedDefault {
		t.Fatalf("expected default output %q, got %q", expectedDefault, defaultCandidate.OutputPath)
	}

	outputDirCandidate, err := PlanCandidate(NormalizedRequest{
		OutputDir: filepath.Join(string(filepath.Separator), "tmp", "output"),
	}, inputFile, inputRoot, false)
	if err != nil {
		t.Fatalf("PlanCandidate with output dir returned error: %v", err)
	}
	expectedOutputDir := filepath.Join(string(filepath.Separator), "tmp", "output", "nested", "photo.compressed.jpg")
	if outputDirCandidate.OutputPath != expectedOutputDir {
		t.Fatalf("expected output-dir path %q, got %q", expectedOutputDir, outputDirCandidate.OutputPath)
	}

	overwriteCandidate, err := PlanCandidate(NormalizedRequest{
		OutputDir: filepath.Join(string(filepath.Separator), "tmp", "output"),
		Overwrite: true,
	}, inputFile, inputRoot, false)
	if err != nil {
		t.Fatalf("PlanCandidate with overwrite returned error: %v", err)
	}
	expectedOverwrite := filepath.Join(string(filepath.Separator), "tmp", "output", "nested", "photo.jpg")
	if overwriteCandidate.OutputPath != expectedOverwrite {
		t.Fatalf("expected overwrite path %q, got %q", expectedOverwrite, overwriteCandidate.OutputPath)
	}
}
