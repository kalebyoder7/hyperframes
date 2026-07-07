export interface LoudnormTarget {
  integratedLufs: number; // I
  truePeakDb: number; // TP
  loudnessRangeLu: number; // LRA
}

export const DEFAULT_LOUDNORM_TARGET: LoudnormTarget = {
  integratedLufs: -16, // good default for social/short-form; broadcast is typically -23
  truePeakDb: -1.5,
  loudnessRangeLu: 11,
};

export interface LoudnormMeasurement {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

// ffmpeg's loudnorm filter recommends a two-pass approach for accurate
// results: pass 1 measures the input's actual loudness stats, pass 2 applies
// normalization using those measured values. These builders are pure
// (no I/O) so they're unit-testable without ffmpeg installed.
export function buildFirstPassArgs(
  inputPath: string,
  target: LoudnormTarget = DEFAULT_LOUDNORM_TARGET,
): string[] {
  return [
    "-i",
    inputPath,
    "-af",
    `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDb}:LRA=${target.loudnessRangeLu}:print_format=json`,
    "-f",
    "null",
    "-",
  ];
}

// ffmpeg prints the pass-1 JSON measurement block to stderr, surrounded by
// human-readable log lines. Extracts just the JSON object.
export function parseLoudnormMeasurement(stderr: string): LoudnormMeasurement {
  const jsonStart = stderr.lastIndexOf("{");
  const jsonEnd = stderr.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error("could not find loudnorm JSON measurement in ffmpeg output");
  }
  const raw = stderr.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(raw) as LoudnormMeasurement;
}

export function buildSecondPassArgs(
  inputPath: string,
  outputPath: string,
  measurement: LoudnormMeasurement,
  target: LoudnormTarget = DEFAULT_LOUDNORM_TARGET,
): string[] {
  const filter =
    `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDb}:LRA=${target.loudnessRangeLu}:` +
    `measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:` +
    `measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:` +
    `offset=${measurement.target_offset}:linear=true:print_format=summary`;
  return ["-y", "-i", inputPath, "-af", filter, "-ar", "48000", outputPath];
}
