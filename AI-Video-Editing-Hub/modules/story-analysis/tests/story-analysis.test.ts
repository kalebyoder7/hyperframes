import { describe, expect, test } from "bun:test";
import { detectSceneBoundaries } from "../src/sceneDetection.js";
import { NoOpSpeakerDetector } from "../src/speakerDetection.js";
import {
  AnthropicStoryAnalyzer,
  buildPrompt,
  parseAnalysisResponse,
  StoryAnalysisError,
} from "../src/narrativeAnalysis.js";
import type { Transcript, TranscriptSegment } from "../../../shared/src/types.js";

function seg(id: string, start: number, end: number, text = "text"): TranscriptSegment {
  return { id, start, end, text };
}

describe("detectSceneBoundaries", () => {
  test("returns empty array for no segments", () => {
    expect(detectSceneBoundaries([])).toEqual([]);
  });

  test("keeps segments in one scene when gaps are small", () => {
    const scenes = detectSceneBoundaries([seg("1", 0, 5), seg("2", 5.2, 10)], {
      silenceGapThresholdSec: 1,
    });
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({ start: 0, end: 10 });
  });

  test("splits into multiple scenes on long silence gaps", () => {
    const scenes = detectSceneBoundaries([seg("1", 0, 5), seg("2", 10, 15), seg("3", 15.1, 20)], {
      silenceGapThresholdSec: 1,
    });
    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toMatchObject({ start: 0, end: 5 });
    expect(scenes[1]).toMatchObject({ start: 10, end: 20 });
  });
});

describe("NoOpSpeakerDetector", () => {
  test("labels every segment as speaker-1", async () => {
    const detector = new NoOpSpeakerDetector();
    const result = await detector.detect([seg("1", 0, 5), seg("2", 5, 10)]);
    expect(result.every((s) => s.speaker === "speaker-1")).toBe(true);
  });

  test("preserves an already-set speaker label", async () => {
    const detector = new NoOpSpeakerDetector();
    const result = await detector.detect([{ ...seg("1", 0, 5), speaker: "host" }]);
    expect(result[0]?.speaker).toBe("host");
  });
});

describe("buildPrompt", () => {
  test("interpolates transcript JSON into the template", () => {
    const transcript: Transcript = {
      sourceAssetId: "asset-1",
      language: "en",
      segments: [seg("seg-0", 0, 5, "hello world")],
    };
    const prompt = buildPrompt(transcript);
    expect(prompt).toContain("hello world");
    expect(prompt).not.toContain("{{TRANSCRIPT_JSON}}");
  });
});

describe("parseAnalysisResponse", () => {
  test("parses a well-formed model response into a StoryAnalysisResult", () => {
    const text = `Here is the analysis:\n\`\`\`json\n${JSON.stringify({
      summary: "A video about X.",
      narrativeArc: "setup -> payoff",
      highlights: [{ start: 1, end: 5, score: 0.9, reason: "strong hook" }],
    })}\n\`\`\``;
    const result = parseAnalysisResponse(text);
    expect(result.summary).toBe("A video about X.");
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0]).toMatchObject({ start: 1, end: 5, score: 0.9 });
  });

  test("throws StoryAnalysisError when no JSON is present", () => {
    expect(() => parseAnalysisResponse("no json here")).toThrow(StoryAnalysisError);
  });
});

describe("AnthropicStoryAnalyzer", () => {
  test("throws StoryAnalysisError when no API key is configured", async () => {
    const analyzer = new AnthropicStoryAnalyzer({ apiKey: undefined });
    const transcript: Transcript = { sourceAssetId: "a", language: "en", segments: [] };
    await expect(analyzer.analyze(transcript)).rejects.toThrow(StoryAnalysisError);
  });

  test("calls the Anthropic Messages API and maps the response", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                summary: "summary text",
                narrativeArc: "arc",
                highlights: [{ start: 0, end: 2, score: 0.5, reason: "ok" }],
              }),
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const analyzer = new AnthropicStoryAnalyzer({ apiKey: "test-key", fetchFn: fakeFetch });
    const transcript: Transcript = {
      sourceAssetId: "a",
      language: "en",
      segments: [seg("seg-0", 0, 2, "hello")],
    };
    const result = await analyzer.analyze(transcript);

    expect(result.summary).toBe("summary text");
    expect(result.highlights).toHaveLength(1);
    expect(calls[0]?.url).toContain("/messages");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
  });
});
