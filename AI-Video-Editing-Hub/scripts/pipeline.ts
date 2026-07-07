#!/usr/bin/env bun
// End-to-end MVP pipeline: ingest -> transcribe -> detect highlights ->
// build timeline -> generate captions -> render -> normalize audio ->
// validate against platform preset. Wires together every "real" module;
// stub/interface-only modules (publishing uploads, platform speaker
// diarization, general motion graphics) are intentionally not invoked here
// — see each module's README for what's implemented vs. planned.
//
// Usage:
//   bun scripts/pipeline.ts --input /path/to/source.mp4 [options]
//   bun scripts/pipeline.ts --input clip.mp4 --config configs/nab-style.config.json
//
// Options:
//   --config <path>                   (default: configs/default.config.json; see also configs/nab-style.config.json)
//   --platform <tiktok|youtube-shorts|instagram-reels|youtube-landscape|linkedin>  (overrides config)
//   --target-duration <seconds>       (overrides config)
//   --min-score <0-1>                 (overrides config)
//   --transcription <openai|local>    (default: openai)
//   --story-analyzer <heuristic|anthropic>  (default: heuristic)
//   --no-captions                     (overrides config)
//   --no-normalize                    (overrides config)
//   --out-dir <path>                  (default: ../exports)
//
// CLI flags only override a config field when explicitly passed — otherwise
// the loaded --config file's value (or its own default) wins.

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../shared/src/config.js";
import { createLogger } from "../shared/src/logger.js";
import type { PipelineConfig } from "../shared/src/types.js";

import { ingestVideo } from "../modules/video-ingest/src/index.js";
import {
  OpenAIWhisperProvider,
  LocalWhisperProvider,
  transcribe,
} from "../modules/transcription/src/index.js";
import { extractAudioTrack, normalizeAudio } from "../modules/audio/src/index.js";
import {
  detectHighlights,
  type HighlightDetectionOptions,
} from "../modules/clip-selection/src/index.js";
import { AnthropicStoryAnalyzer } from "../modules/story-analysis/src/index.js";
import { buildTimeline } from "../modules/timeline/src/index.js";
import {
  generateCaptions,
  generateKaraokeCaptions,
  toSRT,
  toVTT,
  toASS,
} from "../modules/captioning/src/index.js";
import { getPreset, renderTimeline } from "../modules/rendering/src/index.js";
import { validateAgainstPreset } from "../modules/publishing/src/index.js";
import { JsonlAnalyticsSink } from "../modules/analytics/src/index.js";
import type { CaptionCue, HighlightSegment, Platform, Transcript } from "../shared/src/types.js";

const HUB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const logger = createLogger("pipeline");

interface CliOptions {
  input: string;
  configPath: string;
  platform?: Platform;
  targetDuration?: number;
  minScore?: number;
  transcriptionProvider: "openai" | "local";
  storyAnalyzer: "heuristic" | "anthropic";
  captions?: boolean;
  normalize?: boolean;
  outDir: string;
}

// Only returns a field when the corresponding flag was actually passed, so
// callers can distinguish "use the config file's value" from "override it" —
// a CLI default here would otherwise silently clobber --config on every run.
function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      config: { type: "string" },
      platform: { type: "string" },
      "target-duration": { type: "string" },
      "min-score": { type: "string" },
      transcription: { type: "string", default: "openai" },
      "story-analyzer": { type: "string", default: "heuristic" },
      "no-captions": { type: "boolean" },
      "no-normalize": { type: "boolean" },
      "out-dir": { type: "string", default: join(HUB_ROOT, "exports") },
    },
  });

  if (!values.input) {
    throw new Error("--input <path/to/source.mp4> is required");
  }

  return {
    input: resolve(values.input),
    configPath: values.config
      ? resolve(values.config)
      : join(HUB_ROOT, "configs", "default.config.json"),
    platform: values.platform as Platform | undefined,
    targetDuration:
      values["target-duration"] !== undefined ? Number(values["target-duration"]) : undefined,
    minScore: values["min-score"] !== undefined ? Number(values["min-score"]) : undefined,
    transcriptionProvider: values.transcription as "openai" | "local",
    storyAnalyzer: values["story-analyzer"] as "heuristic" | "anthropic",
    captions: values["no-captions"] !== undefined ? !values["no-captions"] : undefined,
    normalize: values["no-normalize"] !== undefined ? !values["no-normalize"] : undefined,
    outDir: resolve(values["out-dir"] as string),
  };
}

async function stage<T>(
  analytics: JsonlAnalyticsSink,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  await analytics.track("stage.started", { stage: name });
  logger.info(`stage started: ${name}`);
  try {
    const result = await fn();
    await analytics.track("stage.completed", { stage: name, durationMs: Date.now() - startedAt });
    logger.info(`stage completed: ${name}`, { durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await analytics.track("stage.failed", {
      stage: name,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    logger.error(`stage failed: ${name}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function run(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));

  const overrides: Partial<PipelineConfig> = {};
  if (cli.platform !== undefined) overrides.platform = cli.platform;
  if (cli.targetDuration !== undefined) overrides.targetDurationSec = cli.targetDuration;
  if (cli.minScore !== undefined) overrides.minHighlightScore = cli.minScore;
  if (cli.captions !== undefined) overrides.burnCaptions = cli.captions;
  if (cli.normalize !== undefined) overrides.normalizeAudio = cli.normalize;

  const config: PipelineConfig = loadConfig(cli.configPath, overrides);

  const jobId = randomUUID();
  const jobDir = join(cli.outDir, jobId);
  await mkdir(jobDir, { recursive: true });

  const analytics = new JsonlAnalyticsSink(join(HUB_ROOT, "logs", "pipeline-events.jsonl"));
  logger.info("pipeline starting", { jobId, input: cli.input, config });

  const asset = await stage(analytics, "video-ingest", () => ingestVideo(cli.input));

  const transcript: Transcript = await stage(analytics, "transcription", async () => {
    if (cli.transcriptionProvider === "local") {
      const wavPath = join(jobDir, "audio.wav");
      await extractAudioTrack(asset.path, wavPath);
      return transcribe(new LocalWhisperProvider(), wavPath, asset.id);
    }
    // OpenAI's hosted Whisper endpoint accepts common video containers (mp4/mov/webm)
    // directly, so no separate audio-extraction step is needed on this path.
    return transcribe(new OpenAIWhisperProvider(), asset.path, asset.id);
  });
  await writeFile(join(jobDir, "transcript.json"), JSON.stringify(transcript, null, 2));

  const highlights: HighlightSegment[] = await stage(analytics, "clip-selection", async () => {
    if (cli.storyAnalyzer === "anthropic") {
      const result = await new AnthropicStoryAnalyzer().analyze(transcript);
      await writeFile(
        join(jobDir, "story-analysis.json"),
        JSON.stringify({ summary: result.summary, narrativeArc: result.narrativeArc }, null, 2),
      );
      return result.highlights;
    }
    const highlightOptions: HighlightDetectionOptions = {
      minScore: config.minHighlightScore,
      targetDurationSec: config.targetDurationSec,
    };
    // Only set when a style preset (e.g. configs/nab-style.config.json)
    // provides them — otherwise clip-selection's own defaults (3-20s) apply.
    if (config.idealClipMinSec !== undefined)
      highlightOptions.idealClipMinSec = config.idealClipMinSec;
    if (config.idealClipMaxSec !== undefined)
      highlightOptions.idealClipMaxSec = config.idealClipMaxSec;
    return detectHighlights(transcript.segments, highlightOptions);
  });
  await writeFile(join(jobDir, "highlights.json"), JSON.stringify(highlights, null, 2));

  const timeline = await stage(analytics, "timeline", async () =>
    buildTimeline(asset.id, highlights, asset.durationSec),
  );
  await writeFile(join(jobDir, "timeline.json"), JSON.stringify(timeline, null, 2));

  const isKaraoke = config.captionStyle === "karaoke";
  const captions: CaptionCue[] = config.burnCaptions
    ? await stage(analytics, "captioning", async () =>
        isKaraoke
          ? generateKaraokeCaptions(transcript, timeline)
          : generateCaptions(transcript, timeline),
      )
    : [];
  if (captions.length > 0) {
    if (isKaraoke) {
      await writeFile(
        join(jobDir, "captions.ass"),
        toASS(captions, { colors: config.captionColors }),
      );
    } else {
      await writeFile(join(jobDir, "captions.srt"), toSRT(captions));
      await writeFile(join(jobDir, "captions.vtt"), toVTT(captions));
    }
  }

  const preset = getPreset(config.platform);
  const draftPath = join(jobDir, "draft.mp4");
  await stage(analytics, "rendering", async () =>
    renderTimeline(
      {
        id: jobId,
        asset,
        timeline,
        captions,
        preset,
        outputPath: draftPath,
      },
      {
        burnCaptions: config.burnCaptions,
        captionFormat: isKaraoke ? "ass" : "srt",
        assColors: config.captionColors,
      },
    ),
  );

  let finalPath = draftPath;
  if (config.normalizeAudio && asset.hasAudio) {
    finalPath = join(jobDir, "final.mp4");
    await stage(analytics, "audio-normalize", async () => normalizeAudio(draftPath, finalPath));
  }

  const issues = validateAgainstPreset(
    config.platform,
    timeline.totalDurationSec,
    preset.width,
    preset.height,
  );
  if (issues.length > 0) {
    logger.warn("export does not fully match platform preset", { issues });
  }

  logger.info("pipeline complete", { jobId, finalPath, durationSec: timeline.totalDurationSec });
  console.log(`\nDone. Job artifacts: ${jobDir}\nFinal export: ${finalPath}`);
}

run().catch((error) => {
  logger.error("pipeline failed", {
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  console.error(error);
  process.exit(1);
});
