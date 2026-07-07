import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RenderError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../shared/src/exec.js";
import type { RenderJob } from "../../../shared/src/types.js";
import { toSRT } from "../../captioning/src/index.js";
import { buildFfmpegArgs } from "./ffmpegArgs.js";

export { buildFfmpegArgs, buildFilterGraph, escapeSubtitlesPath } from "./ffmpegArgs.js";
export { EXPORT_PRESETS, getPreset } from "./presets.js";

const logger = createLogger("rendering");

export interface RenderOptions {
  exec?: ExecFn;
  burnCaptions?: boolean;
}

// Renders a RenderJob's timeline to a final export MP4 via ffmpeg: trims and
// concatenates the timeline's clips, scales/pads to the target platform
// aspect ratio, and optionally burns in the job's captions as an SRT track.
// Requires ffmpeg on PATH.
export async function renderTimeline(job: RenderJob, options: RenderOptions = {}): Promise<string> {
  const exec = options.exec ?? realExec;
  const burnCaptions = options.burnCaptions ?? true;

  let srtPath: string | undefined;
  let workDir: string | undefined;

  try {
    if (burnCaptions && job.captions.length > 0) {
      workDir = await mkdtemp(join(tmpdir(), "ai-video-editing-hub-render-"));
      srtPath = join(workDir, "captions.srt");
      await writeFile(srtPath, toSRT(job.captions), "utf-8");
    }

    const args = buildFfmpegArgs(job, { burnSubtitlesPath: srtPath });
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
