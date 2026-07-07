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

export interface PipelineConfig {
  targetDurationSec: number;
  minHighlightScore: number;
  platform: Platform;
  burnCaptions: boolean;
  normalizeAudio: boolean;
}
