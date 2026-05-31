/**
 * @file CompressionDomainModel
 * @project SlothTool
 * @module Image Compress Plugin / Domain
 * @description 定义图片压缩领域模型、阶段状态、标准请求结果以及内部归一化任务结构。
 * @logic 1. 统一批处理请求与结果语义；2. 提供内部候选文件与标准化请求结构；3. 为应用层和基础设施层建立稳定契约。
 * @dependencies Standard Library: time
 * @index_tags 图片压缩, 领域模型, 请求结果, 候选文件, 进度阶段
 * @author holic512
 */

package domain

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

type NormalizedRequest struct {
	InputPaths    []string
	Recursive     bool
	OutputDir     string
	Overwrite     bool
	OnlyIfSmaller bool
	Quality       int
	MaxWidth      int
	MaxHeight     int
	Concurrency   int
	DryRun        bool
}

type Candidate struct {
	InputPath    string
	SourceRoot   string
	RelativePath string
	OutputPath   string
	OutputFormat string
	ExplicitFile bool
}
