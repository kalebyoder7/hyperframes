import type { TranscriptSegment } from "../../../shared/src/types.js";

export interface SpeakerDetector {
  readonly name: string;
  detect(segments: TranscriptSegment[]): Promise<TranscriptSegment[]>;
}

// Placeholder implementation: labels every segment as a single speaker.
// Real diarization (distinguishing multiple speakers) requires either an
// API (e.g. AssemblyAI's speaker_labels) or a local model (e.g. pyannote.audio)
// — deliberately not implemented here; see README. This class exists so the
// rest of the pipeline can depend on the SpeakerDetector interface today and
// swap in a real provider later without call-site changes.
export class NoOpSpeakerDetector implements SpeakerDetector {
  readonly name = "no-op-single-speaker";

  async detect(segments: TranscriptSegment[]): Promise<TranscriptSegment[]> {
    return segments.map((s) => ({ ...s, speaker: s.speaker ?? "speaker-1" }));
  }
}
