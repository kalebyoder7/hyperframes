# story-analysis

Covers three of the "Core Modules" from the spec: Speaker Detection, Scene
Detection, and Story Analysis (narrative understanding / LLM-scored
highlights). Status differs per piece — see below.

## `detectSceneBoundaries` — Status: **Real / functional**

Dependency-free heuristic: splits a transcript into scenes wherever the
pause between consecutive segments exceeds `silenceGapThresholdSec` (default
1.5s). This is a **text-timing** heuristic, not visual shot detection — it
has no idea about cuts, camera changes, or lighting changes that happen
without a corresponding pause in speech.

## `NoOpSpeakerDetector` — Status: **Placeholder, honestly labeled**

Labels every transcript segment as a single speaker. Real diarization
(telling multiple speakers apart) needs either a hosted API (e.g.
AssemblyAI's `speaker_labels`) or a local model (e.g. pyannote.audio) —
deliberately not implemented in this session. The `SpeakerDetector`
interface exists so a real provider can be dropped in later without
changing any call sites.

## `AnthropicStoryAnalyzer` — Status: **Real / functional**

LLM-backed alternative to `clip-selection/`'s offline heuristic: sends the
full transcript to Claude in a single call (prompt template in
`prompts/story-analysis.prompt.md`) and gets back a narrative summary plus
scored highlight candidates, mapped into the same `HighlightSegment[]`
contract `clip-selection/` produces — so `scripts/pipeline.ts` can use
either interchangeably.

Requires `ANTHROPIC_API_KEY` and network access; not mocked.

```ts
import { AnthropicStoryAnalyzer } from "./src/index.js";

const analyzer = new AnthropicStoryAnalyzer();
const { summary, narrativeArc, highlights } = await analyzer.analyze(transcript);
```

Each `HighlightSegment` may also carry a `visualSuggestion` string — per
`docs/creative/nab-style-guide.md`'s house rules (baked into
`prompts/story-analysis.prompt.md`), the model suggests whether a beat calls
for an AI-generated cinematic reenactment, a real archival/press photo, an
AI-generated creature/character render, or a comedic reaction/meme insert —
matching asset type to the claim being made rather than defaulting to one
look. **This is advisory metadata only**: nothing in the hub sources,
generates, or auto-inserts the suggested asset — it's written to
`story-analysis.json` by `scripts/pipeline.ts` for a human editor (or a
future automation) to act on. `clip-selection/`'s offline heuristic never
populates this field.

## Not yet implemented

- Real speaker diarization provider.
- Visual scene-cut detection (frame-difference / shot-boundary analysis).
- Multi-turn refinement (asking the model to revise highlights against
  editor feedback).
