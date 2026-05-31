/**
 * @file CompressionRun
 * @project SlothTool
 * @module Image Compress Plugin / Backend API
 * @description 提供对外稳定的批处理运行入口，并将公共 API 类型转换到内部应用层。
 * @logic 1. 将公开请求映射为内部请求；2. 代理进度事件回调；3. 将内部汇总结果转换回公开结构。
 * @dependencies Application: ../../internal/application, Domain: ../../internal/domain, Standard Library: context
 * @index_tags 图片压缩, Run入口, API适配, 应用层代理
 * @author holic512
 */

package compress

import (
	"context"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/application"
	"github.com/holic512/SlothTool/plugins/image-compress/backend/internal/domain"
)

func Run(ctx context.Context, req CompressionRequest, observer ProgressObserver) (BatchSummary, error) {
	summary, err := application.Run(ctx, toDomainRequest(req), toDomainObserver(observer))
	return fromDomainSummary(summary), err
}

func toDomainRequest(req CompressionRequest) domain.CompressionRequest {
	return domain.CompressionRequest{
		InputPaths:    append([]string(nil), req.InputPaths...),
		Recursive:     req.Recursive,
		OutputDir:     req.OutputDir,
		Overwrite:     req.Overwrite,
		OnlyIfSmaller: req.OnlyIfSmaller,
		Quality:       req.Quality,
		MaxWidth:      req.MaxWidth,
		MaxHeight:     req.MaxHeight,
		Concurrency:   req.Concurrency,
		DryRun:        req.DryRun,
	}
}

func toDomainObserver(observer ProgressObserver) domain.ProgressObserver {
	if observer == nil {
		return nil
	}

	return func(event domain.ProgressEvent) {
		observer(ProgressEvent{
			Stage:       Stage(event.Stage),
			Index:       event.Index,
			Total:       event.Total,
			CurrentPath: event.CurrentPath,
			Message:     event.Message,
			Status:      ResultStatus(event.Status),
		})
	}
}

func fromDomainSummary(summary domain.BatchSummary) BatchSummary {
	results := make([]CompressionResult, 0, len(summary.Results))
	for _, result := range summary.Results {
		results = append(results, CompressionResult{
			InputPath:        result.InputPath,
			OutputPath:       result.OutputPath,
			Format:           result.Format,
			OriginalBytes:    result.OriginalBytes,
			ResultBytes:      result.ResultBytes,
			BytesSaved:       result.BytesSaved,
			CompressionRatio: result.CompressionRatio,
			Width:            result.Width,
			Height:           result.Height,
			OutputWidth:      result.OutputWidth,
			OutputHeight:     result.OutputHeight,
			Status:           ResultStatus(result.Status),
			Error:            result.Error,
			Duration:         result.Duration,
		})
	}

	return BatchSummary{
		Results:      results,
		TotalFiles:   summary.TotalFiles,
		SuccessCount: summary.SuccessCount,
		SkippedCount: summary.SkippedCount,
		FailedCount:  summary.FailedCount,
		SavedBytes:   summary.SavedBytes,
		Cancelled:    summary.Cancelled,
		Duration:     summary.Duration,
	}
}
