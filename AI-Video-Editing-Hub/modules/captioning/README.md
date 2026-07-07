# captioning

Status: **Real / functional.**

Generates `CaptionCue[]` from a `Transcript`, with two responsibilities:

1. **Timeline re-basing** — if a `Timeline` (from `timeline/`) is passed,
   cues are re-based onto the edited/trimmed output using
   `mapSourceTimeToTimeline`, and any cue that falls entirely inside a cut
   section is dropped. This lets captions be generated once from the full
   transcript and stay correct after highlight-based trimming.
2. **Word-wrapping** — long segments are split into multiple cues at
   `maxCharsPerCue` (default 42, standard broadcast-caption length), with
   timing distributed proportionally by character count.

## API

```ts
import { generateCaptions, toSRT, toVTT } from "./src/index.js";

const cues = generateCaptions(transcript, timeline);
await Bun.write("captions.srt", toSRT(cues));
await Bun.write("captions.vtt", toVTT(cues));
```

## Not yet implemented

- Speaker-name prefixes (`[Speaker 1]:`) when diarization is available.
- Styling metadata (position, color) for burned-in caption presets — currently
  plain SRT/VTT text only; `rendering/` owns the burn-in visual style.
- Multi-language caption tracks from a single transcript.
