# timeline

Status: **Real / functional.**

Converts chronologically-sorted `HighlightSegment[]` (from `clip-selection/`)
into an ordered `Timeline` (an edit-decision-list): merges highlights that
are close enough together to avoid jump-cutty micro-clips, applies optional
padding, and clamps to source duration.

## API

```ts
import { buildTimeline, mapSourceTimeToTimeline } from "./src/index.js";

const timeline = buildTimeline(asset.id, highlights, asset.durationSec, {
  gapMergeThresholdSec: 0.75,
});
```

`mapSourceTimeToTimeline` re-bases a source-video timestamp onto the trimmed
timeline's output timeline (or `null` if it falls inside a cut) — used by
`captioning/` to keep caption timing correct after edits.

## Not yet implemented

- Multi-source timelines (cutting between multiple source clips/B-roll).
- Transition metadata (crossfade/hard-cut hints) between merged clips.
- Manual timeline overrides / re-ordering UI hook.
