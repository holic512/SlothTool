/**
 * @file FileScanner
 * @project SlothTool
 * @module Image Compress Plugin / Infrastructure
 * @description 扫描输入路径并生成待处理图片候选列表，同时校验输出目录和目标路径冲突。
 * @logic 1. 遍历文件或目录收集支持的图片；2. 根据领域规则规划输出路径；3. 按输入路径排序并检查输出碰撞。
 * @dependencies Domain: ../domain, Standard Library: fmt/io/fs/os/path/filepath/sort
 * @index_tags 图片扫描, 目录遍历, 候选文件, 输出冲突, 相对路径
 * @author holic512
 */

package infrastructure

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/domain"
)

func Scan(req domain.NormalizedRequest) ([]domain.Candidate, error) {
	if req.OutputDir != "" {
		info, err := os.Stat(req.OutputDir)
		if err == nil && !info.IsDir() {
			return nil, fmt.Errorf("output directory %q is not a directory", req.OutputDir)
		}
		if err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("inspect output directory %q: %w", req.OutputDir, err)
		}
	}

	candidates := make([]domain.Candidate, 0)
	for _, inputPath := range req.InputPaths {
		info, err := os.Stat(inputPath)
		if err != nil {
			return nil, fmt.Errorf("inspect input path %q: %w", inputPath, err)
		}

		if !info.IsDir() {
			candidate, err := domain.PlanCandidate(req, inputPath, filepath.Dir(inputPath), true)
			if err != nil {
				return nil, err
			}
			candidates = append(candidates, candidate)
			continue
		}

		if req.Recursive {
			err = filepath.WalkDir(inputPath, func(path string, entry fs.DirEntry, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}
				if entry.IsDir() {
					return nil
				}
				if !domain.IsSupportedInputExtension(path) {
					return nil
				}

				candidate, err := domain.PlanCandidate(req, path, inputPath, false)
				if err != nil {
					return err
				}
				candidates = append(candidates, candidate)
				return nil
			})
			if err != nil {
				return nil, fmt.Errorf("scan input directory %q: %w", inputPath, err)
			}
			continue
		}

		entries, err := os.ReadDir(inputPath)
		if err != nil {
			return nil, fmt.Errorf("scan input directory %q: %w", inputPath, err)
		}
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			path := filepath.Join(inputPath, entry.Name())
			if !domain.IsSupportedInputExtension(path) {
				continue
			}

			candidate, err := domain.PlanCandidate(req, path, inputPath, false)
			if err != nil {
				return nil, err
			}
			candidates = append(candidates, candidate)
		}
	}

	sort.Slice(candidates, func(i int, j int) bool {
		return candidates[i].InputPath < candidates[j].InputPath
	})

	seenOutputs := make(map[string]string, len(candidates))
	for _, candidate := range candidates {
		if previousInputPath, ok := seenOutputs[candidate.OutputPath]; ok {
			return nil, fmt.Errorf(
				"planned output collision between %q and %q for %q",
				previousInputPath,
				candidate.InputPath,
				candidate.OutputPath,
			)
		}
		seenOutputs[candidate.OutputPath] = candidate.InputPath
	}

	return candidates, nil
}
