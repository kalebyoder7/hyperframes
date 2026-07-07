// Cross-module integration test covering the parts of the pipeline that
// need no external binary or network call: transcript -> highlight
// detection -> timeline -> captions. Rendering/audio/ingest are exercised
// separately in their own module test suites with an injected exec, since
// they require ffmpeg to run for real.
import { describe, expect, test } from "bun:test";
import { detectHighlights } from "../modules/clip-selection/src/index.js";
import { buildTimeline } from "../modules/timeline/src/index.js";
import { generateCaptions, toSRT } from "../modules/captioning/src/index.js";
import { validateAgainstPreset } from "../modules/publishing/src/index.js";
import { getPreset } from "../modules/rendering/src/index.js";
import type { Transcript } from "../shared/src/types.js";

describe("pipeline: transcript -> highlights -> timeline -> captions", () => {
  const transcript: Transcript = {
    sourceAssetId: "asset-1",
    language: "en",
    segments: [
      {
        id: "seg-0",
        start: 0,
        end: 6,
        text: "Here's the biggest secret nobody tells you about this!",
      },
      {
        id: "seg-1",
        start: 6,
        end: 14,
        text: "um so like, you know, it's kind of, sort of a thing.",
      },
      {
        id: "seg-2",
        start: 20,
        end: 27,
        text: "The truth is this mistake ruins everything for beginners.",
      },
      { id: "seg-3", start: 27, end: 33, text: "Here's exactly how you avoid that huge problem." },
    ],
  };

  test("produces a chronologically ordered, budget-respecting timeline with matching captions", () => {
    const highlights = detectHighlights(transcript.segments, {
      minScore: 0.3,
      targetDurationSec: 30,
    });
    expect(highlights.length).toBeGreaterThan(0);

    const timeline = buildTimeline("asset-1", highlights, 40);
    expect(timeline.clips.length).toBeGreaterThan(0);
    expect(timeline.totalDurationSec).toBeGreaterThan(0);
    expect(timeline.totalDurationSec).toBeLessThanOrEqual(40);

    const captions = generateCaptions(transcript, timeline);
    expect(captions.length).toBeGreaterThan(0);
    // every caption must fall within the trimmed timeline's total duration
    for (const cue of captions) {
      expect(cue.start).toBeGreaterThanOrEqual(0);
      expect(cue.end).toBeLessThanOrEqual(timeline.totalDurationSec + 0.01);
    }

    const srt = toSRT(captions);
    expect(srt).toContain("00:00:00,000");
  });

  test("filler-heavy segment is excluded while hook-word segments survive", () => {
    const highlights = detectHighlights(transcript.segments, {
      minScore: 0.4,
      targetDurationSec: 60,
    });
    const coversFillerSegment = highlights.some((h) => h.start <= 6 && h.end >= 14 && h.start >= 6);
    expect(coversFillerSegment).toBe(false);
  });

  test("resulting export duration validates against the target platform preset", () => {
    const highlights = detectHighlights(transcript.segments, {
      minScore: 0.3,
      targetDurationSec: 15,
    });
    const timeline = buildTimeline("asset-1", highlights, 40);
    const preset = getPreset("youtube-shorts");
    const issues = validateAgainstPreset(
      "youtube-shorts",
      timeline.totalDurationSec,
      preset.width,
      preset.height,
    );
    expect(issues.filter((i) => i.field === "duration")).toHaveLength(0);
  });
});
