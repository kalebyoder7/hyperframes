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
//
// Options:
//   --platform <tiktok|youtube-shorts|instagram-reels|youtube-landscape|linkedin>  (default: youtube-shorts)
//   --target-duration <seconds>       (default: 60)
//   --min-score <0-1>                 (default: 0.35)
//   --transcription <openai|local>    (default: openai)
//   --story-analyzer <heuristic|anthropic>  (default: heuristic)
//   --no-captions
//   --no-normalize
//   --out-dir <path>                  (default: ../exports)

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
import { detectHighlights } from "../modules/clip-selection/src/index.js";
import { AnthropicStoryAnalyzer } from "../modules/story-analysis/src/index.js";
import { buildTimeline } from "../modules/timeline/src/index.js";
import { generateCaptions, toSRT, toVTT } from "../modules/captioning/src/index.js";
import { getPreset, renderTimeline } from "../modules/rendering/src/index.js";
import { validateAgainstPreset } from "../modules/publishing/src/index.js";
import { JsonlAnalyticsSink } from "../modules/analytics/src/index.js";
import type { HighlightSegment, Platform, Transcript } from "../shared/src/types.js";

const HUB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const logger = createLogger("pipeline");

interface CliOptions {
  input: string;
  platform: Platform;
  targetDuration: number;
  minScore: number;
  transcriptionProvider: "openai" | "local";
  storyAnalyzer: "heuristic" | "anthropic";
  captions: boolean;
  normalize: boolean;
  outDir: string;
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      platform: { type: "string", default: "youtube-shorts" },
      "target-duration": { type: "string", default: "60" },
      "min-score": { type: "string", default: "0.35" },
      transcription: { type: "string", default: "openai" },
      "story-analyzer": { type: "string", default: "heuristic" },
      "no-captions": { type: "boolean", default: false },
      "no-normalize": { type: "boolean", default: false },
      "out-dir": { type: "string", default: join(HUB_ROOT, "exports") },
    },
  });

  if (!values.input) {
    throw new Error("--input <path/to/source.mp4> is required");
  }

  return {
    input: resolve(values.input),
    platform: values.platform as Platform,
    targetDuration: Number(values["target-duration"]),
    minScore: Number(values["min-score"]),
    transcriptionProvider: values.transcription as "openai" | "local",
    storyAnalyzer: values["story-analyzer"] as "heuristic" | "anthropic",
    captions: !values["no-captions"],
    normalize: !values["no-normalize"],
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
  const config: PipelineConfig = loadConfig(join(HUB_ROOT, "configs", "default.config.json"), {
    platform: cli.platform,
    targetDurationSec: cli.targetDuration,
    minHighlightScore: cli.minScore,
    burnCaptions: cli.captions,
    normalizeAudio: cli.normalize,
  });

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
    return detectHighlights(transcript.segments, {
      minScore: config.minHighlightScore,
      targetDurationSec: config.targetDurationSec,
    });
  });
  await writeFile(join(jobDir, "highlights.json"), JSON.stringify(highlights, null, 2));

  const timeline = await stage(analytics, "timeline", async () =>
    buildTimeline(asset.id, highlights, asset.durationSec),
  );
  await writeFile(join(jobDir, "timeline.json"), JSON.stringify(timeline, null, 2));

  const captions = config.burnCaptions
    ? await stage(analytics, "captioning", async () => generateCaptions(transcript, timeline))
    : [];
  if (captions.length > 0) {
    await writeFile(join(jobDir, "captions.srt"), toSRT(captions));
    await writeFile(join(jobDir, "captions.vtt"), toVTT(captions));
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
      { burnCaptions: config.burnCaptions },
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
