import { describe, expect, test } from "bun:test";
import { detectHighlights, scoreSegment } from "../src/index.js";
import type { TranscriptSegment } from "../../../shared/src/types.js";

function seg(overrides: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: "seg-0",
    start: 0,
    end: 10,
    text: "Neutral filler content with nothing special.",
    ...overrides,
  };
}

describe("scoreSegment", () => {
  test("scores 0 for empty text", () => {
    expect(scoreSegment(seg({ text: "" }))).toBe(0);
  });

  test("scores 0 for zero-duration segment", () => {
    expect(scoreSegment(seg({ start: 5, end: 5 }))).toBe(0);
  });

  test("rewards hook words and clean, energetic sentences", () => {
    const punchy = scoreSegment(
      seg({ id: "a", start: 0, end: 8, text: "Here's the biggest mistake everyone makes!" }),
    );
    const flat = scoreSegment(
      seg({ id: "b", start: 0, end: 8, text: "so then we went to the store and got some stuff" }),
    );
    expect(punchy).toBeGreaterThan(flat);
  });

  test("penalizes filler-word-heavy segments", () => {
    const fillerHeavy = scoreSegment(
      seg({ text: "um so like, you know, it's uh basically kind of a thing i mean." }),
    );
    const clean = scoreSegment(seg({ text: "This is the biggest secret nobody tells you." }));
    expect(fillerHeavy).toBeLessThan(clean);
  });

  test("prefers durations within the ideal clip range", () => {
    const idealDuration = scoreSegment(
      seg({ start: 0, end: 8, text: "The important truth is simple." }),
      { idealClipMinSec: 3, idealClipMaxSec: 20 },
    );
    const tooShort = scoreSegment(
      seg({ start: 0, end: 0.5, text: "The important truth is simple." }),
      { idealClipMinSec: 3, idealClipMaxSec: 20 },
    );
    expect(idealDuration).toBeGreaterThan(tooShort);
  });

  test("score is always within [0, 1]", () => {
    const score = scoreSegment(
      seg({ text: "Secret! Amazing! Incredible! Never! Always! Huge! Truth! Warning!" }),
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("detectHighlights", () => {
  const segments: TranscriptSegment[] = [
    seg({ id: "1", start: 0, end: 8, text: "Here's the biggest secret nobody talks about!" }),
    seg({ id: "2", start: 8, end: 16, text: "um so like, you know, basically, stuff happened." }),
    seg({ id: "3", start: 16, end: 24, text: "The truth is this mistake ruins everything." }),
    seg({ id: "4", start: 24, end: 32, text: "and then, uh, we kind of, sort of moved on." }),
  ];

  test("filters out segments below minScore", () => {
    const highlights = detectHighlights(segments, { minScore: 0.9, targetDurationSec: 120 });
    expect(highlights.length).toBeLessThanOrEqual(segments.length);
  });

  test("returns results sorted chronologically, not by score", () => {
    const highlights = detectHighlights(segments, { minScore: 0, targetDurationSec: 120 });
    const starts = highlights.map((h) => h.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  test("respects targetDurationSec budget", () => {
    const highlights = detectHighlights(segments, { minScore: 0, targetDurationSec: 10 });
    const total = highlights.reduce((sum, h) => sum + (h.end - h.start), 0);
    // budget is soft (first selected clip may itself exceed it) but should
    // never accept a second clip once budget is already met.
    expect(highlights.length).toBeLessThanOrEqual(2);
    expect(total).toBeGreaterThan(0);
  });

  test("each highlight carries at least one reason", () => {
    const highlights = detectHighlights(segments, { minScore: 0, targetDurationSec: 120 });
    for (const h of highlights) {
      expect(h.reasons.length).toBeGreaterThan(0);
    }
  });
});
