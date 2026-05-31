/**
 * @file BatchRunner
 * @project SlothTool
 * @module Image Compress Plugin / Application
 * @description 编排批量压缩任务的扫描、并发执行、进度事件发送、取消处理与汇总统计。
 * @logic 1. 标准化请求并扫描候选文件；2. 用受控并发执行单文件压缩流程；3. 汇总逐文件结果并在取消时返回部分结果。
 * @dependencies Domain: ../domain, Infrastructure: ../infrastructure, Standard Library: context/fmt/os/sync/time
 * @index_tags 批处理编排, 并发压缩, 进度回调, 取消, 汇总统计
 * @author holic512
 */

package application

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/domain"
	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/infrastructure"
)

type indexedCandidate struct {
	index     int
	candidate domain.Candidate
}

type observerSink struct {
	observer domain.ProgressObserver
	mu       sync.Mutex
}

func Run(ctx context.Context, req domain.CompressionRequest, observer domain.ProgressObserver) (domain.BatchSummary, error) {
	startedAt := time.Now()
	sink := observerSink{observer: observer}

	normalizedRequest, err := domain.NormalizeRequest(req)
	if err != nil {
		return domain.BatchSummary{Duration: time.Since(startedAt)}, err
	}

	candidates, err := infrastructure.Scan(normalizedRequest)
	if err != nil {
		return domain.BatchSummary{Duration: time.Since(startedAt)}, err
	}

	sink.Emit(domain.ProgressEvent{
		Stage:   domain.StageScan,
		Total:   len(candidates),
		Message: fmt.Sprintf("discovered %d image files", len(candidates)),
	})

	results := make([]domain.CompressionResult, len(candidates))
	if len(candidates) == 0 {
		summary := summarize(results, false, time.Since(startedAt))
		sink.Emit(domain.ProgressEvent{
			Stage:   domain.StageDone,
			Total:   0,
			Message: "completed with no image files to process",
		})
		return summary, nil
	}

	jobs := make(chan indexedCandidate)
	var workerGroup sync.WaitGroup
	for workerIndex := 0; workerIndex < normalizedRequest.Concurrency; workerIndex++ {
		workerGroup.Add(1)
		go func() {
			defer workerGroup.Done()
			for job := range jobs {
				if ctx.Err() != nil {
					results[job.index] = cancelledResult(job.candidate, 0)
					continue
				}
				results[job.index] = processCandidate(ctx, normalizedRequest, job, len(candidates), &sink)
			}
		}()
	}

	dispatched := 0
	for index, candidate := range candidates {
		if ctx.Err() != nil {
			break
		}

		jobs <- indexedCandidate{
			index:     index,
			candidate: candidate,
		}
		dispatched++
	}
	close(jobs)
	workerGroup.Wait()

	if ctx.Err() != nil {
		for index := dispatched; index < len(candidates); index++ {
			if results[index].InputPath == "" {
				results[index] = cancelledResult(candidates[index], 0)
			}
		}

		summary := summarize(results, true, time.Since(startedAt))
		sink.Emit(domain.ProgressEvent{
			Stage:   domain.StageCancelled,
			Total:   len(candidates),
			Message: "compression cancelled",
			Status:  domain.StatusCancelled,
		})
		return summary, ctx.Err()
	}

	summary := summarize(results, false, time.Since(startedAt))
	sink.Emit(domain.ProgressEvent{
		Stage:   domain.StageDone,
		Total:   len(candidates),
		Message: fmt.Sprintf("completed %d image files", len(candidates)),
	})
	return summary, nil
}

func processCandidate(
	ctx context.Context,
	req domain.NormalizedRequest,
	job indexedCandidate,
	total int,
	sink *observerSink,
) domain.CompressionResult {
	startedAt := time.Now()
	result := domain.CompressionResult{
		InputPath:  job.candidate.InputPath,
		OutputPath: job.candidate.OutputPath,
	}

	sink.Emit(domain.ProgressEvent{
		Stage:       domain.StageValidate,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.InputPath,
		Message:     "validating source and output paths",
	})

	if err := ctx.Err(); err != nil {
		return cancelledResult(job.candidate, time.Since(startedAt))
	}
	if !domain.IsSupportedInputExtension(job.candidate.InputPath) {
		result.Status = domain.StatusSkippedUnsupportedInput
		result.Error = "input file extension is not supported"
		result.Duration = time.Since(startedAt)
		sink.Emit(skipEvent(job, total, result.Status, result.Error))
		return result
	}

	if !req.Overwrite {
		outputExists, err := infrastructure.FileExists(job.candidate.OutputPath)
		if err != nil {
			result.Status = domain.StatusFailed
			result.Error = err.Error()
			result.Duration = time.Since(startedAt)
			return result
		}
		if outputExists {
			result.Status = domain.StatusSkippedExists
			result.Error = "output file already exists"
			result.Duration = time.Since(startedAt)
			sink.Emit(skipEvent(job, total, result.Status, result.Error))
			return result
		}
	}

	sourceInfo, err := os.Stat(job.candidate.InputPath)
	if err != nil {
		result.Status = domain.StatusFailed
		result.Error = err.Error()
		result.Duration = time.Since(startedAt)
		return result
	}
	result.OriginalBytes = sourceInfo.Size()

	sink.Emit(domain.ProgressEvent{
		Stage:       domain.StageDecode,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.InputPath,
		Message:     "decoding image",
	})

	if err := ctx.Err(); err != nil {
		return cancelledResult(job.candidate, time.Since(startedAt))
	}

	decodedImage, err := infrastructure.DecodeFile(job.candidate.InputPath)
	if err != nil {
		if errors.Is(err, infrastructure.ErrUnsupportedInputFormat) {
			result.Status = domain.StatusSkippedUnsupportedInput
			result.Error = "input file format is not supported"
			result.Duration = time.Since(startedAt)
			sink.Emit(skipEvent(job, total, result.Status, result.Error))
			return result
		}

		result.Status = domain.StatusFailed
		result.Error = err.Error()
		result.Duration = time.Since(startedAt)
		return result
	}

	result.Format = decodedImage.Format
	result.Width = decodedImage.Width
	result.Height = decodedImage.Height

	sink.Emit(domain.ProgressEvent{
		Stage:       domain.StageTransform,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.InputPath,
		Message:     "applying resize constraints",
	})

	transformedImage, outputWidth, outputHeight, _ := infrastructure.Resize(
		decodedImage.Image,
		req.MaxWidth,
		req.MaxHeight,
	)
	result.OutputWidth = outputWidth
	result.OutputHeight = outputHeight

	sink.Emit(domain.ProgressEvent{
		Stage:       domain.StageEncode,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.InputPath,
		Message:     "encoding compressed image",
	})

	encodedBytes, err := infrastructure.Encode(job.candidate.OutputFormat, transformedImage, req.Quality)
	if err != nil {
		if errors.Is(err, infrastructure.ErrUnsupportedOutputFormat) {
			result.Status = domain.StatusSkippedUnsupportedOutput
			result.Error = "output format is not supported in pure Go mode"
			result.Duration = time.Since(startedAt)
			sink.Emit(skipEvent(job, total, result.Status, result.Error))
			return result
		}

		result.Status = domain.StatusFailed
		result.Error = err.Error()
		result.Duration = time.Since(startedAt)
		return result
	}

	result.ResultBytes = int64(len(encodedBytes))
	result.BytesSaved = result.OriginalBytes - result.ResultBytes
	if result.OriginalBytes > 0 {
		result.CompressionRatio = float64(result.BytesSaved) / float64(result.OriginalBytes)
	}

	if req.OnlyIfSmaller && result.ResultBytes >= result.OriginalBytes {
		result.Status = domain.StatusSkippedNotSmaller
		result.Error = "compressed file is not smaller than the source"
		result.Duration = time.Since(startedAt)
		sink.Emit(skipEvent(job, total, result.Status, result.Error))
		return result
	}

	if req.DryRun {
		result.Status = domain.StatusDryRun
		result.Duration = time.Since(startedAt)
		sink.Emit(skipEvent(job, total, result.Status, "dry-run mode, file not written"))
		return result
	}

	if err := ctx.Err(); err != nil {
		return cancelledResult(job.candidate, time.Since(startedAt))
	}

	sink.Emit(domain.ProgressEvent{
		Stage:       domain.StageWrite,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.OutputPath,
		Message:     "writing compressed image",
	})

	if err := infrastructure.WriteFileAtomic(job.candidate.OutputPath, encodedBytes); err != nil {
		result.Status = domain.StatusFailed
		result.Error = err.Error()
		result.Duration = time.Since(startedAt)
		return result
	}

	result.Status = domain.StatusSuccess
	result.Duration = time.Since(startedAt)
	return result
}

func summarize(results []domain.CompressionResult, cancelled bool, duration time.Duration) domain.BatchSummary {
	summary := domain.BatchSummary{
		Results:    append([]domain.CompressionResult(nil), results...),
		TotalFiles: len(results),
		Cancelled:  cancelled,
		Duration:   duration,
	}

	for _, result := range results {
		switch result.Status {
		case domain.StatusSuccess:
			summary.SuccessCount++
			if result.BytesSaved > 0 {
				summary.SavedBytes += result.BytesSaved
			}
		case domain.StatusFailed, domain.StatusCancelled:
			summary.FailedCount++
		case "":
			continue
		default:
			summary.SkippedCount++
		}
	}

	return summary
}

func cancelledResult(candidate domain.Candidate, duration time.Duration) domain.CompressionResult {
	return domain.CompressionResult{
		InputPath:  candidate.InputPath,
		OutputPath: candidate.OutputPath,
		Status:     domain.StatusCancelled,
		Error:      "compression cancelled",
		Duration:   duration,
	}
}

func skipEvent(
	job indexedCandidate,
	total int,
	status domain.ResultStatus,
	message string,
) domain.ProgressEvent {
	return domain.ProgressEvent{
		Stage:       domain.StageSkip,
		Index:       job.index + 1,
		Total:       total,
		CurrentPath: job.candidate.InputPath,
		Message:     message,
		Status:      status,
	}
}

func (sink *observerSink) Emit(event domain.ProgressEvent) {
	if sink.observer == nil {
		return
	}

	sink.mu.Lock()
	defer sink.mu.Unlock()
	sink.observer(event)
}
