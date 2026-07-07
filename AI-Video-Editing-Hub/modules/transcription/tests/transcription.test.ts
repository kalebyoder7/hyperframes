import { describe, expect, test } from "bun:test";
import { mapToTranscript, OpenAIWhisperProvider } from "../src/providers/openaiWhisper.js";
import { mapWhisperCppOutput, LocalWhisperProvider } from "../src/providers/localWhisper.js";
import { TranscriptionError } from "../../../shared/src/errors.js";

describe("mapToTranscript (OpenAI)", () => {
  test("maps segments and attaches words within range", () => {
    const transcript = mapToTranscript(
      {
        language: "english",
        segments: [
          { id: 0, start: 0, end: 2.5, text: " Hello there. " },
          { id: 1, start: 2.5, end: 5, text: " General Kenobi. " },
        ],
        words: [
          { word: "Hello", start: 0, end: 0.5 },
          { word: "there", start: 0.6, end: 1.0 },
          { word: "General", start: 2.5, end: 3.0 },
        ],
      },
      "asset-123",
    );

    expect(transcript.sourceAssetId).toBe("asset-123");
    expect(transcript.segments).toHaveLength(2);
    expect(transcript.segments[0]?.text).toBe("Hello there.");
    expect(transcript.segments[0]?.words).toHaveLength(2);
    expect(transcript.segments[1]?.words).toHaveLength(1);
  });
});

describe("OpenAIWhisperProvider", () => {
  test("throws TranscriptionError when no API key is configured", async () => {
    const provider = new OpenAIWhisperProvider({ apiKey: undefined });
    await expect(provider.transcribe("/nonexistent.wav", "asset-1")).rejects.toThrow(
      TranscriptionError,
    );
  });

  test("calls fetch with multipart form and maps a successful response", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: url as string, init });
      return new Response(
        JSON.stringify({
          language: "english",
          segments: [{ id: 0, start: 0, end: 1, text: "hi" }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const provider = new OpenAIWhisperProvider({ apiKey: "test-key", fetchFn: fakeFetch });

    // Point at a real, tiny temp file so readFile succeeds.
    const tmpPath = `${import.meta.dir}/__fixture_audio.tmp`;
    await Bun.write(tmpPath, "fake-audio-bytes");
    try {
      const transcript = await provider.transcribe(tmpPath, "asset-9");
      expect(transcript.segments[0]?.text).toBe("hi");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toContain("/audio/transcriptions");
    } finally {
      await Bun.file(tmpPath)
        .delete?.()
        .catch(() => {});
    }
  });
});

describe("mapWhisperCppOutput", () => {
  test("maps whisper.cpp segments to Transcript", () => {
    const transcript = mapWhisperCppOutput(
      {
        language: "en",
        segments: [{ id: 0, start: 0, end: 1.2, text: " test segment " }],
      },
      "asset-42",
    );
    expect(transcript.language).toBe("en");
    expect(transcript.segments[0]?.text).toBe("test segment");
  });
});

describe("LocalWhisperProvider", () => {
  test("throws TranscriptionError when no model path is configured", async () => {
    const provider = new LocalWhisperProvider({ modelPath: "" });
    await expect(provider.transcribe("/nonexistent.wav", "asset-1")).rejects.toThrow(
      TranscriptionError,
    );
  });
});
