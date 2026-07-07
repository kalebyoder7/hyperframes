import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PipelineError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import type { HighlightSegment, Transcript } from "../../../shared/src/types.js";

const logger = createLogger("story-analysis:narrative");

export class StoryAnalysisError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "story-analysis", cause);
  }
}

export interface StoryAnalysisResult {
  summary: string;
  narrativeArc: string;
  highlights: HighlightSegment[];
}

interface ClaudeHighlightJson {
  start: number;
  end: number;
  score: number;
  reason: string;
}

interface ClaudeStoryAnalysisJson {
  summary: string;
  narrativeArc: string;
  highlights: ClaudeHighlightJson[];
}

export interface AnthropicStoryAnalyzerOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const PROMPT_TEMPLATE_PATH = fileURLToPath(
  new URL("../../../prompts/story-analysis.prompt.md", import.meta.url),
);

// LLM-backed alternative to clip-selection/'s heuristic scorer: sends the
// full transcript to Claude in one call and asks for a narrative summary
// plus scored highlight candidates (see prompts/story-analysis.prompt.md).
// Real implementation via native fetch against the Anthropic Messages API —
// requires ANTHROPIC_API_KEY and network access, not mocked.
export class AnthropicStoryAnalyzer {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: AnthropicStoryAnalyzerOptions = {}) {
    this.apiKey = options.apiKey ?? process.env["ANTHROPIC_API_KEY"];
    // Model IDs shift over time — override via ANTHROPIC_MODEL or the
    // constructor option rather than relying on this default staying current.
    this.model = options.model ?? process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-5";
    this.baseUrl = options.baseUrl ?? "https://api.anthropic.com/v1";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async analyze(transcript: Transcript): Promise<StoryAnalysisResult> {
    if (!this.apiKey) {
      throw new StoryAnalysisError(
        "ANTHROPIC_API_KEY is not set — required for AnthropicStoryAnalyzer. " +
          "Set it in the environment or pass { apiKey } explicitly.",
      );
    }

    const prompt = buildPrompt(transcript);
    logger.info("submitting story analysis request", {
      model: this.model,
      segmentCount: transcript.segments.length,
    });

    const response = await this.fetchFn(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new StoryAnalysisError(
        `Anthropic story analysis request failed (${response.status}): ${body}`,
      );
    }

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = payload.content?.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new StoryAnalysisError("Anthropic response contained no text content block");
    }

    return parseAnalysisResponse(text);
  }
}

export function buildPrompt(transcript: Transcript): string {
  const template = readFileSync(PROMPT_TEMPLATE_PATH, "utf-8");
  const transcriptJson = JSON.stringify(
    transcript.segments.map((s) => ({ id: s.id, start: s.start, end: s.end, text: s.text })),
    null,
    2,
  );
  return template.replace("{{TRANSCRIPT_JSON}}", transcriptJson);
}

export function parseAnalysisResponse(text: string): StoryAnalysisResult {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new StoryAnalysisError(
      `could not find a JSON object in the model response: ${text.slice(0, 200)}`,
    );
  }

  let parsed: ClaudeStoryAnalysisJson;
  try {
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (cause) {
    throw new StoryAnalysisError("model response JSON failed to parse", cause);
  }

  const highlights: HighlightSegment[] = (parsed.highlights ?? []).map((h, i) => ({
    id: `llm-hl-${i}`,
    start: h.start,
    end: h.end,
    score: h.score,
    reasons: [h.reason],
    sourceSegmentIds: [],
  }));

  return {
    summary: parsed.summary ?? "",
    narrativeArc: parsed.narrativeArc ?? "",
    highlights,
  };
}
