import { PipelineError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../shared/src/exec.js";
import { buildColorArgs, type ColorPresetName } from "./presets.js";

export { buildColorArgs, buildEqFilter } from "./presets.js";
export type { ColorPresetName } from "./presets.js";

const logger = createLogger("color");

export class ColorProcessingError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "color", cause);
  }
}

export interface ApplyColorPresetOptions {
  exec?: ExecFn;
}

// Applies a basic brightness/contrast/saturation/gamma color preset via
// ffmpeg's `eq` filter. See modules/color/README.md for what this
// deliberately does not do yet (LUTs, scopes-driven auto-correction, HDR).
export async function applyColorPreset(
  inputPath: string,
  outputPath: string,
  preset: ColorPresetName,
  options: ApplyColorPresetOptions = {},
): Promise<string> {
  const exec = options.exec ?? realExec;
  try {
    logger.info("applying color preset", { inputPath, preset });
    await exec("ffmpeg", buildColorArgs(inputPath, outputPath, preset));
    return outputPath;
  } catch (cause) {
    throw new ColorProcessingError(`color preset '${preset}' failed for ${inputPath}`, cause);
  }
}
