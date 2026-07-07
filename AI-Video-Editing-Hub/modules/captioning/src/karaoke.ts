import type {
  CaptionCue,
  Timeline,
  Transcript,
  TranscriptSegment,
} from "../../../shared/src/types.js";
import { mapSourceTimeToTimeline } from "../../timeline/src/index.js";

export interface KaraokeCaptionOptions {
  wordsPerCue?: number; // 1-3 word groups, per docs/creative/nab-style-guide.md
}

const DEFAULTS: Required<KaraokeCaptionOptions> = { wordsPerCue: 2 };

// Word-level, two-tone "karaoke" captions per docs/creative/nab-style-guide.md
// (bold, heavy stroke, color alternates per word/short phrase, tightly
// synced to speech) — a materially different rhythm from generateCaptions'
// sentence-chunked SRT/VTT style. Prefers per-word timestamps
// (TranscriptSegment.words, when the transcription provider returned them)
// for accurate sync; falls back to proportional character-based timing
// within the segment otherwise, same approach as the phrase-based captioner.
export function generateKaraokeCaptions(
  transcript: Transcript,
  timeline?: Timeline,
  options: KaraokeCaptionOptions = {},
): CaptionCue[] {
  const opts = { ...DEFAULTS, ...options };
  const cues: CaptionCue[] = [];
  let colorToggle: 0 | 1 = 0;

  for (const segment of transcript.segments) {
    const rebased = timeline ? rebaseSegment(segment, timeline) : segment;
    if (!rebased) continue;

    const groups = segment.words
      ? groupTimedWords(rebased, segment.words, timeline, opts.wordsPerCue)
      : groupUntimedWords(rebased, opts.wordsPerCue);

    for (const group of groups) {
      cues.push({
        index: 0,
        start: group.start,
        end: group.end,
        text: group.text,
        colorIndex: colorToggle,
      });
      colorToggle = colorToggle === 0 ? 1 : 0;
    }
  }

  return reindex(cues);
}

function rebaseSegment(segment: TranscriptSegment, timeline: Timeline): TranscriptSegment | null {
  const start = mapSourceTimeToTimeline(timeline, segment.start);
  const end = mapSourceTimeToTimeline(timeline, segment.end);
  if (start === null || end === null || end <= start) return null;
  return { ...segment, start, end };
}

interface WordGroup {
  text: string;
  start: number;
  end: number;
}

function groupTimedWords(
  rebasedSegment: TranscriptSegment,
  originalWords: NonNullable<TranscriptSegment["words"]>,
  timeline: Timeline | undefined,
  wordsPerCue: number,
): WordGroup[] {
  const groups: WordGroup[] = [];
  for (let i = 0; i < originalWords.length; i += wordsPerCue) {
    const chunk = originalWords.slice(i, i + wordsPerCue);
    const rawStart = chunk[0]!.start;
    const rawEnd = chunk[chunk.length - 1]!.end;
    const start = timeline ? mapSourceTimeToTimeline(timeline, rawStart) : rawStart;
    const end = timeline ? mapSourceTimeToTimeline(timeline, rawEnd) : rawEnd;
    if (start === null || end === null || end <= start) continue;
    groups.push({
      text: chunk
        .map((w) => w.word)
        .join(" ")
        .trim(),
      start,
      end,
    });
  }
  if (groups.length > 0) return groups;
  // words array was present but produced nothing usable (e.g. entirely cut) — fall back.
  return groupUntimedWords(rebasedSegment, wordsPerCue);
}

function groupUntimedWords(segment: TranscriptSegment, wordsPerCue: number): WordGroup[] {
  const words = segment.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    chunks.push(words.slice(i, i + wordsPerCue).join(" "));
  }

  const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
  const duration = segment.end - segment.start;
  let cursor = segment.start;
  return chunks.map((text) => {
    const share = (text.length / totalChars) * duration;
    const start = cursor;
    const end = cursor + share;
    cursor = end;
    return { text, start, end };
  });
}

function reindex(cues: CaptionCue[]): CaptionCue[] {
  return cues.map((cue, i) => ({ ...cue, index: i + 1 }));
}

export interface ASSOptions {
  colors?: [string, string]; // [primary, secondary] hex, e.g. ["#39FF14", "#FFFFFF"]
  videoWidth?: number;
  videoHeight?: number;
  fontSize?: number;
  fontName?: string;
}

const ASS_DEFAULTS: Required<ASSOptions> = {
  colors: ["#39FF14", "#FFFFFF"],
  videoWidth: 1080,
  videoHeight: 1920,
  fontSize: 72,
  fontName: "Arial Black",
};

// Renders karaoke-style CaptionCue[] (with colorIndex set) as an .ass
// (Advanced SubStation Alpha) subtitle file — plain SRT/VTT can't express
// per-cue color alternation or a heavy stroke; ASS can, and ffmpeg's
// `subtitles` filter (used by modules/rendering) accepts .ass directly.
export function toASS(cues: CaptionCue[], options: ASSOptions = {}): string {
  const opts = { ...ASS_DEFAULTS, ...options };
  const [primary, secondary] = opts.colors;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${opts.videoWidth}
PlayResY: ${opts.videoHeight}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Color0,${opts.fontName},${opts.fontSize},${hexToAssColor(primary)},${hexToAssColor(primary)},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,60,60,220,1
Style: Color1,${opts.fontName},${opts.fontSize},${hexToAssColor(secondary)},${hexToAssColor(secondary)},&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,60,60,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = cues
    .map((cue) => {
      const style = cue.colorIndex === 1 ? "Color1" : "Color0";
      return `Dialogue: 0,${formatAssTimestamp(cue.start)},${formatAssTimestamp(cue.end)},${style},,0,0,0,,${escapeAssText(cue.text)}`;
    })
    .join("\n");

  return `${header}\n${events}\n`;
}

// ASS uses &HAABBGGRR (alpha inverted: 00 = fully opaque) rather than the
// usual RRGGBB — this converts a standard "#RRGGBB" hex string.
export function hexToAssColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text.replace(/\n/g, "\\N").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function formatAssTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const centiseconds = Math.round((clamped - Math.floor(clamped)) * 100);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}
