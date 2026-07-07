import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RenderError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../shared/src/exec.js";
import type { RenderJob } from "../../../shared/src/types.js";
import { toSRT, toASS } from "../../captioning/src/index.js";
import { buildFfmpegArgs } from "./ffmpegArgs.js";

export { buildFfmpegArgs, buildFilterGraph, escapeSubtitlesPath } from "./ffmpegArgs.js";
export { EXPORT_PRESETS, getPreset } from "./presets.js";

const logger = createLogger("rendering");

export interface RenderOptions {
  exec?: ExecFn;
  burnCaptions?: boolean;
  // "srt" (default) burns job.captions as plain text via toSRT. "ass" burns
  // them via toASS, preserving each cue's colorIndex — use this when
  // job.captions came from captioning/'s generateKaraokeCaptions (see
  // docs/creative/nab-style-guide.md); plain SRT can't express per-cue color.
  captionFormat?: "srt" | "ass";
  assColors?: [string, string];
}

// Renders a RenderJob's timeline to a final export MP4 via ffmpeg: trims and
// concatenates the timeline's clips, scales/pads to the target platform
// aspect ratio, and optionally burns in the job's captions (SRT or ASS).
// Requires ffmpeg on PATH.
export async function renderTimeline(job: RenderJob, options: RenderOptions = {}): Promise<string> {
  const exec = options.exec ?? realExec;
  const burnCaptions = options.burnCaptions ?? true;
  const captionFormat = options.captionFormat ?? "srt";

  let subtitlesPath: string | undefined;
  let workDir: string | undefined;

  try {
    if (burnCaptions && job.captions.length > 0) {
      workDir = await mkdtemp(join(tmpdir(), "ai-video-editing-hub-render-"));
      if (captionFormat === "ass") {
        subtitlesPath = join(workDir, "captions.ass");
        await writeFile(
          subtitlesPath,
          toASS(job.captions, options.assColors ? { colors: options.assColors } : undefined),
          "utf-8",
        );
      } else {
        subtitlesPath = join(workDir, "captions.srt");
        await writeFile(subtitlesPath, toSRT(job.captions), "utf-8");
      }
    }

    const args = buildFfmpegArgs(job, { burnSubtitlesPath: subtitlesPath });
    logger.info("rendering timeline", {
      jobId: job.id,
      outputPath: job.outputPath,
      clipCount: job.timeline.clips.length,
    });

    await exec("ffmpeg", args);
    logger.info("render complete", { jobId: job.id, outputPath: job.outputPath });
    return job.outputPath;
  } catch (cause) {
    if (cause instanceof RenderError) throw cause;
    throw new RenderError(
      `ffmpeg render failed for job ${job.id} — is ffmpeg installed and on PATH?`,
      cause,
    );
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
