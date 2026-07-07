import type { SceneBoundary, TranscriptSegment } from "../../../shared/src/types.js";

export interface SceneDetectionOptions {
  silenceGapThresholdSec?: number;
}

const DEFAULTS: Required<SceneDetectionOptions> = { silenceGapThresholdSec: 1.5 };

// Real, dependency-free scene-boundary detector: splits a transcript into
// scenes wherever the pause between consecutive segments exceeds
// silenceGapThresholdSec. This is a text-timing heuristic, not visual shot
// detection (no frame analysis) — see README for that gap.
export function detectSceneBoundaries(
  segments: TranscriptSegment[],
  options: SceneDetectionOptions = {},
): SceneBoundary[] {
  const opts = { ...DEFAULTS, ...options };
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const scenes: SceneBoundary[] = [];
  let sceneStart = sorted[0]!.start;

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    const gap = next.start - current.end;
    if (gap > opts.silenceGapThresholdSec) {
      scenes.push({
        id: `scene-${scenes.length}`,
        start: sceneStart,
        end: current.end,
        reason: "silence-gap",
      });
      sceneStart = next.start;
    }
  }

  const last = sorted[sorted.length - 1]!;
  scenes.push({
    id: `scene-${scenes.length}`,
    start: sceneStart,
    end: last.end,
    reason: "silence-gap",
  });
  return scenes;
}
