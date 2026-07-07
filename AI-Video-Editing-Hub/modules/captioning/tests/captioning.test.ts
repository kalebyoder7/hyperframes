import { describe, expect, test } from "bun:test";
import { generateCaptions, toSRT, toVTT } from "../src/index.js";
import { buildTimeline } from "../../timeline/src/index.js";
import type { Transcript, HighlightSegment } from "../../../shared/src/types.js";

function transcript(segments: Transcript["segments"]): Transcript {
  return { sourceAssetId: "asset-1", language: "en", segments };
}

describe("generateCaptions", () => {
  test("wraps long segments into multiple cues within maxCharsPerCue", () => {
    const t = transcript([
      {
        id: "seg-0",
        start: 0,
        end: 10,
        text: "This is a fairly long sentence that should definitely wrap across more than one caption cue for sure",
      },
    ]);
    const cues = generateCaptions(t, undefined, { maxCharsPerCue: 30 });
    expect(cues.length).toBeGreaterThan(1);
    for (const cue of cues) {
      expect(cue.text.length).toBeLessThanOrEqual(30);
    }
    // timing should be contiguous and increasing
    expect(cues[0]?.start).toBe(0);
    expect(cues[cues.length - 1]?.end).toBeCloseTo(10, 5);
  });

  test("re-indexes cues sequentially starting at 1", () => {
    const t = transcript([
      { id: "seg-0", start: 0, end: 2, text: "short one" },
      { id: "seg-1", start: 2, end: 4, text: "short two" },
    ]);
    const cues = generateCaptions(t);
    expect(cues.map((c) => c.index)).toEqual([1, 2]);
  });

  test("re-bases cues onto a trimmed timeline and drops cut cues", () => {
    const t = transcript([
      { id: "seg-0", start: 0, end: 5, text: "kept segment one" },
      { id: "seg-1", start: 10, end: 12, text: "this gets cut" },
      { id: "seg-2", start: 20, end: 25, text: "kept segment two" },
    ]);
    const highlights: HighlightSegment[] = [
      { id: "h1", start: 0, end: 5, score: 1, reasons: [], sourceSegmentIds: ["seg-0"] },
      { id: "h2", start: 20, end: 25, score: 1, reasons: [], sourceSegmentIds: ["seg-2"] },
    ];
    const timeline = buildTimeline("asset-1", highlights, 30);
    const cues = generateCaptions(t, timeline);

    const texts = cues.map((c) => c.text);
    expect(texts.join(" ")).not.toContain("cut");
    // second kept segment should start at 5s on the trimmed timeline (right after first clip)
    const secondCue = cues.find((c) => c.text.includes("segment two"));
    expect(secondCue?.start).toBeCloseTo(5, 5);
  });
});

describe("toSRT", () => {
  test("formats a cue as valid SRT", () => {
    const srt = toSRT([{ index: 1, start: 1.5, end: 3.25, text: "Hello world" }]);
    expect(srt).toContain("1\n00:00:01,500 --> 00:00:03,250\nHello world\n");
  });
});

describe("toVTT", () => {
  test("formats cues with WEBVTT header and dot ms separator", () => {
    const vtt = toVTT([{ index: 1, start: 0, end: 1, text: "Hi" }]);
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.000");
  });
});
