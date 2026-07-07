import { randomUUID } from "node:crypto";
import type { HighlightSegment, Timeline, TimelineClip } from "../../../shared/src/types.js";

export interface TimelineOptions {
  gapMergeThresholdSec?: number; // merge highlights closer together than this
  padStartSec?: number; // pad each clip by this many seconds on either side
}

const DEFAULTS: Required<TimelineOptions> = {
  gapMergeThresholdSec: 0.75,
  padStartSec: 0,
};

// Builds an ordered edit-decision-list (Timeline) from chronologically
// sorted HighlightSegments: merges near-adjacent highlights (avoids
// jump-cutty micro-clips), applies optional padding, and clamps to the
// source asset's duration.
export function buildTimeline(
  sourceAssetId: string,
  highlights: HighlightSegment[],
  sourceDurationSec: number,
  options: TimelineOptions = {},
): Timeline {
  const opts = { ...DEFAULTS, ...options };
  const sorted = [...highlights].sort((a, b) => a.start - b.start);

  const merged = mergeCloseHighlights(sorted, opts.gapMergeThresholdSec);

  const clips: TimelineClip[] = merged.map((h, index) => {
    const sourceStart = Math.max(0, h.start - opts.padStartSec);
    const sourceEnd = Math.min(sourceDurationSec, h.end + opts.padStartSec);
    return { id: `clip-${index}`, sourceStart, sourceEnd, order: index };
  });

  const totalDurationSec = clips.reduce((sum, c) => sum + (c.sourceEnd - c.sourceStart), 0);

  return {
    id: randomUUID(),
    sourceAssetId,
    clips,
    totalDurationSec,
  };
}

export function mergeCloseHighlights(
  sorted: HighlightSegment[],
  gapMergeThresholdSec: number,
): HighlightSegment[] {
  const merged: HighlightSegment[] = [];
  for (const highlight of sorted) {
    const last = merged[merged.length - 1];
    if (last && highlight.start - last.end <= gapMergeThresholdSec) {
      merged[merged.length - 1] = {
        ...last,
        end: Math.max(last.end, highlight.end),
        score: Math.max(last.score, highlight.score),
        reasons: [...new Set([...last.reasons, ...highlight.reasons])],
        sourceSegmentIds: [...last.sourceSegmentIds, ...highlight.sourceSegmentIds],
      };
    } else {
      merged.push({ ...highlight });
    }
  }
  return merged;
}

// Maps a timestamp on the original source video to its position on the
// trimmed timeline output, or null if the timestamp falls in a cut section.
// Used by captioning/ to re-base transcript timing onto the edited timeline.
export function mapSourceTimeToTimeline(timeline: Timeline, sourceTimeSec: number): number | null {
  let elapsed = 0;
  for (const clip of [...timeline.clips].sort((a, b) => a.order - b.order)) {
    if (sourceTimeSec >= clip.sourceStart && sourceTimeSec <= clip.sourceEnd) {
      return elapsed + (sourceTimeSec - clip.sourceStart);
    }
    elapsed += clip.sourceEnd - clip.sourceStart;
  }
  return null;
}
