import type { HighlightSegment, TranscriptSegment } from "../../../shared/src/types.js";
import { countOccurrences, FILLER_WORDS, HOOK_WORDS } from "./keywords.js";

export interface HighlightDetectionOptions {
  minScore?: number;
  targetDurationSec?: number;
  idealClipMinSec?: number;
  idealClipMaxSec?: number;
}

const DEFAULTS: Required<HighlightDetectionOptions> = {
  minScore: 0.35,
  targetDurationSec: 60,
  idealClipMinSec: 3,
  idealClipMaxSec: 20,
};

// Deterministic, dependency-free heuristic scorer. Weighs: hook-word density,
// filler-word penalty, sentence completeness, punctuation energy (questions
// / exclamations), and closeness to an "ideal" standalone-clip duration.
// No network/LLM call — this is intentionally the offline-friendly centerpiece
// of the MVP pipeline. story-analysis/ can later supply an LLM-scored variant
// behind the same signature.
export function scoreSegment(
  segment: TranscriptSegment,
  options: HighlightDetectionOptions = {},
): number {
  const opts = { ...DEFAULTS, ...options };
  const text = segment.text.trim();
  const durationSec = segment.end - segment.start;
  if (!text || durationSec <= 0) return 0;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hookHits = countOccurrences(text, HOOK_WORDS);
  const fillerHits = countOccurrences(text, FILLER_WORDS);

  const hookScore = Math.min(hookHits / Math.max(wordCount, 1) / 0.15, 1); // saturate ~15% hook-word density
  const fillerPenalty = Math.min(fillerHits / Math.max(wordCount, 1) / 0.2, 1);
  const endsCleanly = /[.!?]$/.test(text) ? 1 : 0.4;
  const punctuationEnergy = /[!?]/.test(text) ? 1 : 0.5;

  const durationFit = durationFitScore(durationSec, opts.idealClipMinSec, opts.idealClipMaxSec);

  const score =
    0.35 * hookScore +
    0.2 * endsCleanly +
    0.15 * punctuationEnergy +
    0.3 * durationFit -
    0.25 * fillerPenalty;

  return clamp01(score);
}

function durationFitScore(durationSec: number, idealMin: number, idealMax: number): number {
  if (durationSec >= idealMin && durationSec <= idealMax) return 1;
  if (durationSec < idealMin) return clamp01(durationSec / idealMin);
  const overshoot = durationSec - idealMax;
  return clamp01(1 - overshoot / idealMax);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Scores every transcript segment, keeps those clearing minScore, then greedily
// selects highest-scoring segments (without exceeding targetDurationSec) and
// returns them re-sorted chronologically, ready for the timeline builder.
export function detectHighlights(
  segments: TranscriptSegment[],
  options: HighlightDetectionOptions = {},
): HighlightSegment[] {
  const opts = { ...DEFAULTS, ...options };

  const candidates: HighlightSegment[] = segments
    .map((segment) => {
      const score = scoreSegment(segment, opts);
      return {
        id: `hl-${segment.id}`,
        start: segment.start,
        end: segment.end,
        score,
        reasons: explainScore(segment, score),
        sourceSegmentIds: [segment.id],
      };
    })
    .filter((h) => h.score >= opts.minScore);

  const ranked = [...candidates].sort((a, b) => b.score - a.score);

  const selected: HighlightSegment[] = [];
  let totalDuration = 0;
  for (const candidate of ranked) {
    const duration = candidate.end - candidate.start;
    if (totalDuration + duration > opts.targetDurationSec && selected.length > 0) continue;
    selected.push(candidate);
    totalDuration += duration;
    if (totalDuration >= opts.targetDurationSec) break;
  }

  return selected.sort((a, b) => a.start - b.start);
}

function explainScore(segment: TranscriptSegment, score: number): string[] {
  const reasons: string[] = [];
  const hookHits = countOccurrences(segment.text, HOOK_WORDS);
  if (hookHits > 0) reasons.push(`${hookHits} hook word(s)`);
  if (/[!?]$/.test(segment.text.trim())) reasons.push("high-energy punctuation");
  if (score >= 0.6) reasons.push("strong overall score");
  if (reasons.length === 0) reasons.push("baseline duration/structure fit");
  return reasons;
}
