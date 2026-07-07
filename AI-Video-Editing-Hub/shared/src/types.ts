// Shared domain types used across every module. This is the contract modules
// exchange data through — keep it stable; changing a field here ripples into
// every module's src/index.ts.

export interface VideoAsset {
  id: string;
  path: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  createdAt: string;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
  speaker?: string;
}

export interface Transcript {
  sourceAssetId: string;
  language: string;
  segments: TranscriptSegment[];
}

export interface SceneBoundary {
  id: string;
  start: number;
  end: number;
  reason: "silence-gap" | "speaker-change" | "manual";
}

export interface HighlightSegment {
  id: string;
  start: number;
  end: number;
  score: number;
  reasons: string[];
  sourceSegmentIds: string[];
  // Suggested visual treatment for this beat (e.g. "AI-generated cinematic
  // reenactment", "real archival photo", "reaction/meme insert") — informed
  // by docs/creative/nab-style-guide.md. Suggestion only: nothing in the hub
  // sources, generates, or auto-inserts the suggested asset yet. Currently
  // only populated by AnthropicStoryAnalyzer; absent from the offline
  // clip-selection heuristic.
  visualSuggestion?: string;
}

export interface TimelineClip {
  id: string;
  sourceStart: number;
  sourceEnd: number;
  order: number;
}

export interface Timeline {
  id: string;
  sourceAssetId: string;
  clips: TimelineClip[];
  totalDurationSec: number;
}

export interface CaptionCue {
  index: number;
  start: number;
  end: number;
  text: string;
  // Alternating style bucket for karaoke-style two-tone captions (see
  // modules/captioning's generateKaraokeCaptions). Absent for plain
  // phrase-wrapped captions.
  colorIndex?: 0 | 1;
}

export type Platform =
  | "tiktok"
  | "youtube-shorts"
  | "instagram-reels"
  | "youtube-landscape"
  | "linkedin";

export interface ExportPreset {
  platform: Platform;
  width: number;
  height: number;
  fps: number;
  maxDurationSec: number;
  format: "mp4";
}

export interface RenderJob {
  id: string;
  asset: VideoAsset;
  timeline: Timeline;
  captions: CaptionCue[];
  preset: ExportPreset;
  outputPath: string;
}

export type CaptionStyle = "phrase" | "karaoke";

export interface PipelineConfig {
  targetDurationSec: number;
  minHighlightScore: number;
  platform: Platform;
  burnCaptions: boolean;
  normalizeAudio: boolean;
  // "phrase" (default): sentence-chunked SRT/VTT captions, one phrase every
  // few seconds. "karaoke": word-level two-tone captions per
  // docs/creative/nab-style-guide.md, burned in via ASS. See
  // modules/captioning's generateCaptions vs. generateKaraokeCaptions.
  captionStyle: CaptionStyle;
  // [primary, secondary] hex colors alternated per karaoke caption word/phrase.
  // Ignored when captionStyle is "phrase".
  captionColors: [string, string];
  // Optional overrides passed through to clip-selection's detectHighlights.
  // Absent by default so clip-selection's own defaults (3-20s) apply;
  // a style preset like configs/nab-style.config.json can narrow this
  // toward shorter, punchier standalone beats. Note: this tunes which
  // *spoken segments* look like a complete highlight-worthy thought — it is
  // NOT the same as B-roll/visual cut frequency (see docs/creative/nab-style-guide.md),
  // which the hub doesn't automate.
  idealClipMinSec?: number;
  idealClipMaxSec?: number;
}
