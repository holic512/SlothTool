/**
 * @file ImageCompressCliApp
 * @project SlothTool
 * @module Image Compress Plugin / CLI
 * @description 提供图片压缩命令行封装，负责参数解析、结果输出、退出码约定与进度提示。
 * @logic 1. 解析友好的短长参数并组装后端请求；2. 以文本或 JSON 输出逐文件结果与汇总；3. 按全局错误与逐文件失败返回稳定退出码。
 * @dependencies Backend API: ../../pkg/compress, Standard Library: context/encoding/json/errors/flag/fmt/io/path/filepath/strings
 * @index_tags 图片压缩CLI, 参数解析, JSON输出, 退出码, 结果格式化
 * @author holic512
 */

package cli

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/holic512/SlothTool/plugins/image-compress/backend/pkg/compress"
)

type Runner func(context.Context, compress.CompressionRequest, compress.ProgressObserver) (compress.BatchSummary, error)

type App struct {
	stdout io.Writer
	stderr io.Writer
	runner Runner
}

type cliConfig struct {
	request compress.CompressionRequest
	json    bool
	quiet   bool
}

func NewApp(stdout io.Writer, stderr io.Writer) *App {
	return &App{
		stdout: stdout,
		stderr: stderr,
		runner: compress.Run,
	}
}

func (app *App) Run(ctx context.Context, args []string) int {
	config, err := parseArgs(args)
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			_, _ = io.WriteString(app.stdout, usageText())
			return 0
		}

		_, _ = fmt.Fprintf(app.stderr, "error: %v\n\n%s", err, usageText())
		return 2
	}

	observer := app.buildObserver(config)
	summary, runErr := app.runner(ctx, config.request, observer)

	shouldRenderSummary := runErr == nil || summary.TotalFiles > 0 || len(summary.Results) > 0
	if shouldRenderSummary {
		if config.json {
			if err := app.printJSON(summary); err != nil {
				_, _ = fmt.Fprintf(app.stderr, "error: %v\n", err)
				return 1
			}
		} else {
			app.printText(summary)
		}
	}

	if runErr != nil {
		_, _ = fmt.Fprintf(app.stderr, "error: %v\n", runErr)
		return 1
	}
	if summary.FailedCount > 0 || summary.Cancelled {
		return 1
	}
	return 0
}

func parseArgs(args []string) (cliConfig, error) {
	flagSet := flag.NewFlagSet("image-compress", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	var (
		recursiveShort bool
		recursiveLong  bool
		outputShort    string
		outputLong     string
		quality        int
		maxWidth       int
		maxHeight      int
		concurrency    int
		overwrite      bool
		allowLarger    bool
		dryRun         bool
		jsonOutput     bool
		quiet          bool
	)

	flagSet.BoolVar(&recursiveShort, "r", false, "scan directories recursively")
	flagSet.BoolVar(&recursiveLong, "recursive", false, "scan directories recursively")
	flagSet.StringVar(&outputShort, "o", "", "write output files to this directory")
	flagSet.StringVar(&outputLong, "output-dir", "", "write output files to this directory")
	flagSet.BoolVar(&overwrite, "overwrite", false, "replace the source path or target path in output-dir mode")
	flagSet.BoolVar(&allowLarger, "allow-larger", false, "write output even when the compressed file is larger")
	flagSet.IntVar(&quality, "quality", 82, "JPEG quality from 1 to 100")
	flagSet.IntVar(&maxWidth, "max-width", 0, "maximum output width, 0 keeps the original width")
	flagSet.IntVar(&maxHeight, "max-height", 0, "maximum output height, 0 keeps the original height")
	flagSet.IntVar(&concurrency, "concurrency", 0, "worker count, 0 uses the backend default")
	flagSet.BoolVar(&dryRun, "dry-run", false, "run compression without writing files")
	flagSet.BoolVar(&jsonOutput, "json", false, "print summary as JSON")
	flagSet.BoolVar(&quiet, "quiet", false, "hide progress messages on stderr")

	if err := flagSet.Parse(args); err != nil {
		return cliConfig{}, err
	}

	inputPaths := flagSet.Args()
	if len(inputPaths) == 0 {
		return cliConfig{}, fmt.Errorf("at least one input path is required")
	}

	outputDir := firstNonEmpty(outputLong, outputShort)
	onlyIfSmaller := !allowLarger

	return cliConfig{
		request: compress.CompressionRequest{
			InputPaths:    append([]string(nil), inputPaths...),
			Recursive:     recursiveShort || recursiveLong,
			OutputDir:     outputDir,
			Overwrite:     overwrite,
			OnlyIfSmaller: &onlyIfSmaller,
			Quality:       quality,
			MaxWidth:      maxWidth,
			MaxHeight:     maxHeight,
			Concurrency:   concurrency,
			DryRun:        dryRun,
		},
		json:  jsonOutput,
		quiet: quiet,
	}, nil
}

func (app *App) buildObserver(config cliConfig) compress.ProgressObserver {
	if config.quiet || config.json {
		return nil
	}

	return func(event compress.ProgressEvent) {
		switch event.Stage {
		case compress.StageScan, compress.StageDone, compress.StageCancelled:
			_, _ = fmt.Fprintf(app.stderr, "%s\n", event.Message)
		}
	}
}

func (app *App) printText(summary compress.BatchSummary) {
	if len(summary.Results) == 0 {
		_, _ = fmt.Fprintln(app.stdout, "No image files matched the request.")
	} else {
		for _, result := range summary.Results {
			_, _ = fmt.Fprintln(app.stdout, formatResultLine(result))
		}
	}

	_, _ = fmt.Fprintf(
		app.stdout,
		"Summary: total=%d success=%d skipped=%d failed=%d saved=%s duration=%s\n",
		summary.TotalFiles,
		summary.SuccessCount,
		summary.SkippedCount,
		summary.FailedCount,
		formatBytes(summary.SavedBytes),
		summary.Duration.Round(0),
	)
}

func (app *App) printJSON(summary compress.BatchSummary) error {
	encoder := json.NewEncoder(app.stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(summary)
}

func formatResultLine(result compress.CompressionResult) string {
	sourceLabel := filepath.Base(result.InputPath)
	if result.InputPath == "" {
		sourceLabel = "<unknown>"
	}

	if result.Status == compress.StatusSuccess {
		return fmt.Sprintf(
			"SUCCESS %s -> %s | %s -> %s | saved %s (%.1f%%)",
			sourceLabel,
			result.OutputPath,
			formatBytes(result.OriginalBytes),
			formatBytes(result.ResultBytes),
			formatBytes(result.BytesSaved),
			result.CompressionRatio*100,
		)
	}

	if result.Status == compress.StatusDryRun {
		return fmt.Sprintf(
			"DRY-RUN %s -> %s | would save %s (%.1f%%)",
			sourceLabel,
			result.OutputPath,
			formatBytes(result.BytesSaved),
			result.CompressionRatio*100,
		)
	}

	message := strings.TrimSpace(result.Error)
	if message == "" {
		message = "no detail"
	}
	return fmt.Sprintf("%s %s | %s", strings.ToUpper(string(result.Status)), sourceLabel, message)
}

func formatBytes(size int64) string {
	if size < 0 {
		return "-" + formatBytes(-size)
	}

	units := []string{"B", "KB", "MB", "GB"}
	value := float64(size)
	unitIndex := 0
	for value >= 1024 && unitIndex < len(units)-1 {
		value /= 1024
		unitIndex++
	}
	if unitIndex == 0 {
		return fmt.Sprintf("%d %s", size, units[unitIndex])
	}
	return fmt.Sprintf("%.1f %s", value, units[unitIndex])
}

func usageText() string {
	return strings.TrimSpace(`
Usage:
  image-compress [flags] <path> [path...]

Examples:
  image-compress ./photo.jpg
  image-compress -r ./album --output-dir ./compressed
  image-compress ./banner.png --max-width 1280 --max-height 720
  image-compress ./photo.jpg --dry-run --json

Flags:
  -r, --recursive     Scan directories recursively.
  -o, --output-dir    Write output files to this directory.
      --overwrite     Replace the source path or target path in output-dir mode.
      --allow-larger  Write output even when the compressed file is larger.
      --quality       JPEG quality from 1 to 100. Default: 82.
      --max-width     Maximum output width. Default: 0.
      --max-height    Maximum output height. Default: 0.
      --concurrency   Worker count. Default: backend managed.
      --dry-run       Run compression without writing files.
      --json          Print the batch summary as JSON.
      --quiet         Hide progress messages on stderr.
  -h, --help          Show this help message.
`) + "\n"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
