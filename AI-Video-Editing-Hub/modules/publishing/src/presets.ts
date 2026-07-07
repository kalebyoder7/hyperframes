import type { ExportPreset, Platform } from "../../../shared/src/types.js";
import { getPreset } from "../../rendering/src/presets.js";

export interface PublishValidationIssue {
  field: string;
  message: string;
}

// Validates a candidate export against a platform's constraints (duration,
// resolution/aspect ratio). Real, useful on its own even without an actual
// upload integration: catches "this export won't be accepted by TikTok"
// before you try.
export function validateAgainstPreset(
  platform: Platform,
  durationSec: number,
  width: number,
  height: number,
): PublishValidationIssue[] {
  const preset: ExportPreset = getPreset(platform);
  const issues: PublishValidationIssue[] = [];

  if (durationSec > preset.maxDurationSec) {
    issues.push({
      field: "duration",
      message: `${durationSec.toFixed(1)}s exceeds ${platform}'s max of ${preset.maxDurationSec}s`,
    });
  }
  if (width !== preset.width || height !== preset.height) {
    issues.push({
      field: "resolution",
      message: `${width}x${height} does not match ${platform}'s expected ${preset.width}x${preset.height}`,
    });
  }
  return issues;
}
