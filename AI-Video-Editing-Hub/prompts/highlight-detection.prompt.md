You are scoring a single transcript segment for how compelling it would be
as a standalone short-form video clip.

Segment text:

{{SEGMENT_TEXT}}

Respond with a single JSON object, nothing else:

```json
{ "score": 0.0, "reason": "short phrase explaining the score" }
```

`score` is a float from 0 (skip) to 1 (must-include highlight).

Note: this prompt is a reference for a future per-segment LLM scoring mode.
The current implementation (`modules/story-analysis/src/narrativeAnalysis.ts`)
scores the whole transcript in one call via `story-analysis.prompt.md`
instead, which is cheaper and gives the model full-video context — this file
is kept for when per-segment scoring granularity is needed.
