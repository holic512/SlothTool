/**
 * @file CompressionTypes
 * @project SlothTool
 * @module Image Compress Plugin / Backend API
 * @description 定义图片压缩后端对未来 CLI 与 TUI 暴露的稳定请求、结果、阶段与状态类型。
 * @logic 1. 定义批处理请求与结果结构；2. 统一进度阶段与结果状态枚举；3. 暴露观察者接口给上层复用。
 * @dependencies Standard Library: time
 * @index_tags 图片压缩, 后端API, 请求模型, 进度事件, 结果状态
 * @author holic512
 */

package compress

import "time"

type Stage string

const (
	StageScan      Stage = "scan"
	StageValidate  Stage = "validate"
	StageDecode    Stage = "decode"
	StageTransform Stage = "transform"
	StageEncode    Stage = "encode"
	StageWrite     Stage = "write"
	StageSkip      Stage = "skip"
	StageDone      Stage = "done"
	StageCancelled Stage = "cancelled"
)

type ResultStatus string

const (
	StatusSuccess                  ResultStatus = "success"
	StatusDryRun                   ResultStatus = "dry_run"
	StatusSkippedExists            ResultStatus = "skipped_exists"
	StatusSkippedNotSmaller        ResultStatus = "skipped_not_smaller"
	StatusSkippedUnsupportedInput  ResultStatus = "skipped_unsupported_input"
	StatusSkippedUnsupportedOutput ResultStatus = "skipped_unsupported_output"
	StatusFailed                   ResultStatus = "failed"
	StatusCancelled                ResultStatus = "cancelled"
)

type CompressionRequest struct {
	InputPaths    []string
	Recursive     bool
	OutputDir     string
	Overwrite     bool
	OnlyIfSmaller *bool
	Quality       int
	MaxWidth      int
	MaxHeight     int
	Concurrency   int
	DryRun        bool
}

type CompressionResult struct {
	InputPath        string
	OutputPath       string
	Format           string
	OriginalBytes    int64
	ResultBytes      int64
	BytesSaved       int64
	CompressionRatio float64
	Width            int
	Height           int
	OutputWidth      int
	OutputHeight     int
	Status           ResultStatus
	Error            string
	Duration         time.Duration
}

type BatchSummary struct {
	Results      []CompressionResult
	TotalFiles   int
	SuccessCount int
	SkippedCount int
	FailedCount  int
	SavedBytes   int64
	Cancelled    bool
	Duration     time.Duration
}

type ProgressEvent struct {
	Stage       Stage
	Index       int
	Total       int
	CurrentPath string
	Message     string
	Status      ResultStatus
}

type ProgressObserver func(ProgressEvent)
