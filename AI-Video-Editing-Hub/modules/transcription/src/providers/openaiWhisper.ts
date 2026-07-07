import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { TranscriptionError } from "../../../../shared/src/errors.js";
import { createLogger } from "../../../../shared/src/logger.js";
import type { Transcript, TranscriptSegment } from "../../../../shared/src/types.js";
import type { OpenAIVerboseTranscription, TranscriptionProvider } from "../types.js";

const logger = createLogger("transcription:openai-whisper");

export interface OpenAIWhisperProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

// Real implementation of TranscriptionProvider backed by OpenAI's hosted
// Whisper transcription endpoint (`POST /v1/audio/transcriptions`), called
// via native fetch — no SDK dependency. Requires OPENAI_API_KEY (or an
// explicit apiKey) at call time; network access is a hard requirement, this
// is not mocked.
export class OpenAIWhisperProvider implements TranscriptionProvider {
  readonly name = "openai-whisper";
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: OpenAIWhisperProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env["OPENAI_API_KEY"];
    this.model = options.model ?? "whisper-1";
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async transcribe(audioPath: string, sourceAssetId: string): Promise<Transcript> {
    if (!this.apiKey) {
      throw new TranscriptionError(
        "OPENAI_API_KEY is not set — required for OpenAIWhisperProvider. " +
          "Set it in the environment or pass { apiKey } explicitly.",
      );
    }

    const fileBuffer = await readFile(audioPath).catch((cause) => {
      throw new TranscriptionError(`could not read audio file at ${audioPath}`, cause);
    });

    const form = new FormData();
    form.append("file", new Blob([fileBuffer]), basename(audioPath));
    form.append("model", this.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");

    logger.info("submitting transcription request", { audioPath, model: this.model });

    const response = await this.fetchFn(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new TranscriptionError(
        `OpenAI transcription request failed (${response.status}): ${body}`,
      );
    }

    const payload = (await response.json()) as OpenAIVerboseTranscription;
    return mapToTranscript(payload, sourceAssetId);
  }
}

export function mapToTranscript(
  payload: OpenAIVerboseTranscription,
  sourceAssetId: string,
): Transcript {
  const segments: TranscriptSegment[] = payload.segments.map((s) => ({
    id: `seg-${s.id}`,
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    words: payload.words
      ?.filter((w) => w.start >= s.start && w.end <= s.end)
      .map((w) => ({ word: w.word, start: w.start, end: w.end })),
  }));

  return {
    sourceAssetId,
    language: payload.language,
    segments,
  };
}
