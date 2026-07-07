export type ColorPresetName = "flat" | "warm" | "cool" | "punchy";

interface EqParams {
  brightness: number; // -1.0 to 1.0
  contrast: number; // 0.0 to 2.0 (1.0 = no change)
  saturation: number; // 0.0 to 3.0 (1.0 = no change)
  gamma: number; // 0.1 to 10.0 (1.0 = no change)
}

// Simple, explainable presets built on ffmpeg's `eq` filter (brightness /
// contrast / saturation / gamma). This is basic auto color correction, not a
// full grading pipeline — see README "Not yet implemented" for LUT support.
const PRESETS: Record<ColorPresetName, EqParams> = {
  flat: { brightness: 0, contrast: 1.0, saturation: 1.0, gamma: 1.0 },
  warm: { brightness: 0.02, contrast: 1.05, saturation: 1.15, gamma: 1.05 },
  cool: { brightness: 0.0, contrast: 1.05, saturation: 0.95, gamma: 0.97 },
  punchy: { brightness: 0.01, contrast: 1.2, saturation: 1.25, gamma: 1.0 },
};

export function buildEqFilter(preset: ColorPresetName): string {
  const p = PRESETS[preset];
  if (!p) throw new Error(`unknown color preset: ${preset}`);
  return `eq=brightness=${p.brightness}:contrast=${p.contrast}:saturation=${p.saturation}:gamma=${p.gamma}`;
}

export function buildColorArgs(
  inputPath: string,
  outputPath: string,
  preset: ColorPresetName,
): string[] {
  if (preset === "flat") {
    // No-op preset: still re-encode for a consistent output contract, but
    // skip the eq filter entirely rather than applying a filter with no effect.
    return ["-y", "-i", inputPath, "-c:v", "libx264", "-crf", "18", "-c:a", "copy", outputPath];
  }
  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    buildEqFilter(preset),
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-c:a",
    "copy",
    outputPath,
  ];
}
