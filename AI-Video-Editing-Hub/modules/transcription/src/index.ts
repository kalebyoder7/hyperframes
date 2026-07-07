export type { TranscriptionProvider } from "./types.js";
export { OpenAIWhisperProvider, mapToTranscript } from "./providers/openaiWhisper.js";
export { LocalWhisperProvider, mapWhisperCppOutput } from "./providers/localWhisper.js";

import type { Transcript } from "../../../shared/src/types.js";
import type { TranscriptionProvider } from "./types.js";

// Convenience wrapper so callers (e.g. scripts/pipeline.ts) don't need to
// know about the provider interface directly.
export async function transcribe(
  provider: TranscriptionProvider,
  audioPath: string,
  sourceAssetId: string,
): Promise<Transcript> {
  return provider.transcribe(audioPath, sourceAssetId);
}
