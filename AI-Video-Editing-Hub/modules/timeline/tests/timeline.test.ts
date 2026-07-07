import { describe, expect, test } from "bun:test";
import { buildTimeline, mapSourceTimeToTimeline, mergeCloseHighlights } from "../src/index.js";
import type { HighlightSegment } from "../../../shared/src/types.js";

function hl(overrides: Partial<HighlightSegment>): HighlightSegment {
  return {
    id: "hl-0",
    start: 0,
    end: 5,
    score: 0.5,
    reasons: ["test"],
    sourceSegmentIds: ["seg-0"],
    ...overrides,
  };
}

describe("mergeCloseHighlights", () => {
  test("merges highlights within the gap threshold", () => {
    const merged = mergeCloseHighlights(
      [hl({ id: "a", start: 0, end: 5 }), hl({ id: "b", start: 5.5, end: 8 })],
      1,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 0, end: 8 });
  });

  test("keeps highlights separate beyond the gap threshold", () => {
    const merged = mergeCloseHighlights(
      [hl({ id: "a", start: 0, end: 5 }), hl({ id: "b", start: 10, end: 15 })],
      1,
    );
    expect(merged).toHaveLength(2);
  });
});

describe("buildTimeline", () => {
  test("builds ordered clips from highlights", () => {
    const timeline = buildTimeline(
      "asset-1",
      [hl({ id: "a", start: 0, end: 5 }), hl({ id: "b", start: 20, end: 25 })],
      100,
    );
    expect(timeline.clips).toHaveLength(2);
    expect(timeline.clips[0]).toMatchObject({ sourceStart: 0, sourceEnd: 5, order: 0 });
    expect(timeline.clips[1]).toMatchObject({ sourceStart: 20, sourceEnd: 25, order: 1 });
    expect(timeline.totalDurationSec).toBe(10);
  });

  test("clamps padding to source bounds", () => {
    const timeline = buildTimeline("asset-1", [hl({ id: "a", start: 0, end: 5 })], 6, {
      padStartSec: 2,
    });
    expect(timeline.clips[0]?.sourceStart).toBe(0);
    expect(timeline.clips[0]?.sourceEnd).toBe(6);
  });
});

describe("mapSourceTimeToTimeline", () => {
  test("maps a timestamp inside a clip to timeline-relative time", () => {
    const timeline = buildTimeline(
      "asset-1",
      [hl({ id: "a", start: 0, end: 5 }), hl({ id: "b", start: 20, end: 25 })],
      100,
    );
    expect(mapSourceTimeToTimeline(timeline, 2)).toBe(2);
    expect(mapSourceTimeToTimeline(timeline, 22)).toBe(7); // 5s (first clip) + 2s offset
  });

  test("returns null for a timestamp inside a cut section", () => {
    const timeline = buildTimeline(
      "asset-1",
      [hl({ id: "a", start: 0, end: 5 }), hl({ id: "b", start: 20, end: 25 })],
      100,
    );
    expect(mapSourceTimeToTimeline(timeline, 10)).toBeNull();
  });
});
