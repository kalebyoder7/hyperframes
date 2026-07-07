import type { Transcript } from "../../../shared/src/types.js";

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audioPath: string, sourceAssetId: string): Promise<Transcript>;
}

// Shape of OpenAI's verbose_json transcription response (subset we use).
export interface OpenAIVerboseTranscription {
  language: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}
