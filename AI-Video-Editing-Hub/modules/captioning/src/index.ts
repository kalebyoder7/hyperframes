import type {
  CaptionCue,
  Timeline,
  Transcript,
  TranscriptSegment,
} from "../../../shared/src/types.js";
import { mapSourceTimeToTimeline } from "../../timeline/src/index.js";

export { generateKaraokeCaptions, toASS, hexToAssColor } from "./karaoke.js";
export type { KaraokeCaptionOptions, ASSOptions } from "./karaoke.js";

export interface CaptionOptions {
  maxCharsPerCue?: number;
}

const DEFAULTS: Required<CaptionOptions> = {
  maxCharsPerCue: 42, // standard broadcast-caption line length
};

// Generates CaptionCue[] from a transcript. If a Timeline is provided,
// re-bases each cue onto the edited (trimmed) output timeline and drops
// cues that fall entirely inside a cut section — so captions generated from
// the *full* transcript still line up with a highlight-trimmed export.
// Long segments are word-wrapped into multiple cues at maxCharsPerCue,
// with cue timing distributed proportionally by character count.
export function generateCaptions(
  transcript: Transcript,
  timeline?: Timeline,
  options: CaptionOptions = {},
): CaptionCue[] {
  const opts = { ...DEFAULTS, ...options };
  const cues: CaptionCue[] = [];

  for (const segment of transcript.segments) {
    const rebased = timeline ? rebaseSegment(segment, timeline) : segment;
    if (!rebased) continue;
    cues.push(...wrapSegmentIntoCues(rebased, opts.maxCharsPerCue));
  }

  return reindex(cues);
}

function rebaseSegment(segment: TranscriptSegment, timeline: Timeline): TranscriptSegment | null {
  const start = mapSourceTimeToTimeline(timeline, segment.start);
  const end = mapSourceTimeToTimeline(timeline, segment.end);
  if (start === null || end === null || end <= start) return null;
  return { ...segment, start, end };
}

function wrapSegmentIntoCues(segment: TranscriptSegment, maxCharsPerCue: number): CaptionCue[] {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerCue && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
  const duration = segment.end - segment.start;

  let cursor = segment.start;
  return chunks.map((text) => {
    const share = (text.length / totalChars) * duration;
    const start = cursor;
    const end = cursor + share;
    cursor = end;
    return { index: 0, start, end, text };
  });
}

function reindex(cues: CaptionCue[]): CaptionCue[] {
  return cues.map((cue, i) => ({ ...cue, index: i + 1 }));
}

export function toSRT(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue) =>
        `${cue.index}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join("\n");
}

export function toVTT(cues: CaptionCue[]): string {
  const body = cues
    .map(
      (cue) => `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

function formatSrtTimestamp(seconds: number): string {
  return formatTimestamp(seconds, ",");
}

function formatVttTimestamp(seconds: number): string {
  return formatTimestamp(seconds, ".");
}

function formatTimestamp(totalSeconds: number, msSeparator: string): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${msSeparator}${pad(ms, 3)}`;
}
