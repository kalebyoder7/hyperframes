# clip-selection (highlight detection)

Status: **Real / functional.**

Deterministic, dependency-free heuristic scorer over transcript segments —
no network call, no LLM, works fully offline. This is the centerpiece of the
MVP pipeline: it's the one stage that has zero external requirements, so
`scripts/pipeline.ts` always has a working highlight-detection step even
without API keys or ffmpeg installed downstream.

## Scoring signals

- Hook-word density (`src/keywords.ts` → `HOOK_WORDS`)
- Filler-word penalty (`FILLER_WORDS`)
- Sentence completeness (ends on `. ! ?`)
- Punctuation energy (`!`/`?`)
- Closeness to an "ideal" standalone-clip duration (default 3–20s)

## API

```ts
import { detectHighlights } from "./src/index.js";

const highlights = detectHighlights(transcript.segments, {
  minScore: 0.35,
  targetDurationSec: 60,
});
```

Returns `HighlightSegment[]`, greedily selected by score up to
`targetDurationSec`, then re-sorted chronologically for the timeline builder.

## Not yet implemented

- LLM-based scoring variant (semantic "is this a compelling moment" judgment)
  — intended to live in `story-analysis/` and plug into the same
  `HighlightSegment[]` contract, selectable via config.
- Cross-segment merging (combining adjacent short segments into one highlight).
- Speaker-aware weighting (e.g. favor the host over a guest).
