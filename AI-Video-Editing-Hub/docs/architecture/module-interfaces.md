# Module interfaces

Public API surface per module (each also has its own `README.md` with
status/requirements/design notes — this page is the quick-reference).

## `shared/`

```ts
// shared/src/types.ts — the cross-module data contract
VideoAsset, TranscriptWord, TranscriptSegment, Transcript, SceneBoundary,
HighlightSegment, TimelineClip, Timeline, CaptionCue, Platform,
ExportPreset, RenderJob, PipelineConfig

// shared/src/errors.ts
PipelineError, IngestError, TranscriptionError, HighlightDetectionError,
RenderError, ConfigError

// shared/src/logger.ts
createLogger(module: string, logFilePath?: string): Logger

// shared/src/exec.ts
type ExecFn = (command: string, args: string[]) => Promise<{stdout, stderr}>
realExec: ExecFn
isBinaryAvailable(command, exec?): Promise<boolean>

// shared/src/config.ts
loadConfig(configPath?: string, overrides?: Partial<PipelineConfig>): PipelineConfig
```

## `modules/video-ingest/`

```ts
ingestVideo(path: string, options?: { exec?: ExecFn }): Promise<VideoAsset>
```

## `modules/transcription/`

```ts
interface TranscriptionProvider { name: string; transcribe(audioPath, sourceAssetId): Promise<Transcript> }
class OpenAIWhisperProvider implements TranscriptionProvider
class LocalWhisperProvider implements TranscriptionProvider
transcribe(provider, audioPath, sourceAssetId): Promise<Transcript>
```

## `modules/clip-selection/`

```ts
scoreSegment(segment: TranscriptSegment, options?): number  // 0..1
detectHighlights(segments: TranscriptSegment[], options?): HighlightSegment[]
```

## `modules/story-analysis/`

```ts
detectSceneBoundaries(segments: TranscriptSegment[], options?): SceneBoundary[]
class NoOpSpeakerDetector implements SpeakerDetector
class AnthropicStoryAnalyzer {
  analyze(transcript: Transcript): Promise<{ summary, narrativeArc, highlights: HighlightSegment[] }>
}
```

## `modules/timeline/`

```ts
buildTimeline(sourceAssetId, highlights: HighlightSegment[], sourceDurationSec, options?): Timeline
mapSourceTimeToTimeline(timeline: Timeline, sourceTimeSec: number): number | null
```

## `modules/captioning/`

```ts
generateCaptions(transcript: Transcript, timeline?: Timeline, options?): CaptionCue[]
toSRT(cues: CaptionCue[]): string
toVTT(cues: CaptionCue[]): string

// word-level, two-tone "karaoke" style — see docs/creative/nab-style-guide.md
generateKaraokeCaptions(transcript: Transcript, timeline?: Timeline, options?): CaptionCue[]
toASS(cues: CaptionCue[], options?: { colors?: [string, string]; videoWidth?; videoHeight? }): string
hexToAssColor(hex: string): string
```

## `modules/rendering/`

```ts
getPreset(platform: Platform): ExportPreset
renderTimeline(job: RenderJob, options?: {
  exec?: ExecFn;
  burnCaptions?: boolean;
  captionFormat?: "srt" | "ass"; // "ass" for karaoke-style captions
  assColors?: [string, string];
}): Promise<string>
buildFfmpegArgs(job: RenderJob, options?): string[]  // pure, for testing
```

## `modules/audio/`

```ts
extractAudioTrack(inputPath, outputPath, options?): Promise<string>
normalizeAudio(inputPath, outputPath, options?): Promise<string>
```

## `modules/color/`

```ts
applyColorPreset(inputPath, outputPath, preset: "flat"|"warm"|"cool"|"punchy", options?): Promise<string>
```

## `modules/motion-graphics/`

```ts
generateLowerThirdClip(spec: LowerThirdSpec): string  // HyperFrames-compatible HTML
```

## `modules/publishing/`

```ts
validateAgainstPreset(platform, durationSec, width, height): PublishValidationIssue[]
interface PublishTarget { platform: string; upload(filePath, metadata): Promise<PublishResult> }  // unimplemented
```

## `modules/analytics/`

```ts
class JsonlAnalyticsSink implements AnalyticsSink {
  track(name: string, properties?: Record<string, unknown>): Promise<void>
}
```
