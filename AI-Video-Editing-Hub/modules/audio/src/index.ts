import { PipelineError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../shared/src/exec.js";
import {
  buildFirstPassArgs,
  buildSecondPassArgs,
  parseLoudnormMeasurement,
  DEFAULT_LOUDNORM_TARGET,
  type LoudnormTarget,
} from "./loudnorm.js";
import { buildExtractAudioArgs } from "./extract.js";

export {
  buildFirstPassArgs,
  buildSecondPassArgs,
  parseLoudnormMeasurement,
  DEFAULT_LOUDNORM_TARGET,
} from "./loudnorm.js";
export type { LoudnormTarget, LoudnormMeasurement } from "./loudnorm.js";
export { buildExtractAudioArgs } from "./extract.js";

const logger = createLogger("audio");

export class AudioProcessingError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "audio", cause);
  }
}

export interface NormalizeAudioOptions {
  exec?: ExecFn;
  target?: LoudnormTarget;
}

// Two-pass EBU R128 loudness normalization via ffmpeg's `loudnorm` filter:
// pass 1 measures actual input loudness, pass 2 applies correction using
// those measurements (the officially recommended approach for accurate
// results — a single-pass loudnorm is noticeably less precise).
export async function normalizeAudio(
  inputPath: string,
  outputPath: string,
  options: NormalizeAudioOptions = {},
): Promise<string> {
  const exec = options.exec ?? realExec;
  const target = options.target ?? DEFAULT_LOUDNORM_TARGET;

  try {
    logger.info("measuring loudness (pass 1)", { inputPath });
    const pass1 = await exec("ffmpeg", buildFirstPassArgs(inputPath, target));
    const measurement = parseLoudnormMeasurement(pass1.stderr);

    logger.info("applying normalization (pass 2)", { inputPath, outputPath });
    await exec("ffmpeg", buildSecondPassArgs(inputPath, outputPath, measurement, target));

    return outputPath;
  } catch (cause) {
    if (cause instanceof AudioProcessingError) throw cause;
    throw new AudioProcessingError(`audio normalization failed for ${inputPath}`, cause);
  }
}

export interface ExtractAudioOptions {
  exec?: ExecFn;
}

// Extracts a mono 16kHz WAV track from a video file, for transcription
// providers (LocalWhisperProvider) that require raw PCM audio input.
export async function extractAudioTrack(
  inputPath: string,
  outputPath: string,
  options: ExtractAudioOptions = {},
): Promise<string> {
  const exec = options.exec ?? realExec;
  try {
    logger.info("extracting audio track", { inputPath, outputPath });
    await exec("ffmpeg", buildExtractAudioArgs(inputPath, outputPath));
    return outputPath;
  } catch (cause) {
    throw new AudioProcessingError(`audio extraction failed for ${inputPath}`, cause);
  }
}
