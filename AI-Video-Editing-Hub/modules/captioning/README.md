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

## Karaoke mode (two-tone, word-level)

Per `docs/creative/nab-style-guide.md`: word-by-word or short-phrase
captions with alternating two-tone color, tightly synced to speech — a
different rhythm from the sentence-chunked style above (lyric-video-like,
not standard-subtitle-like).

```ts
import { generateKaraokeCaptions, toASS } from "./src/index.js";

const cues = generateKaraokeCaptions(transcript, timeline, { wordsPerCue: 2 });
await Bun.write("captions.ass", toASS(cues, { colors: ["#39FF14", "#FFFFFF"] }));
```

`generateKaraokeCaptions` prefers per-word timestamps
(`TranscriptSegment.words`, when the transcription provider returned them —
OpenAI Whisper does with `timestamp_granularities: ["word"]`, already
requested by `OpenAIWhisperProvider`) for accurate sync, falling back to
proportional character-based timing otherwise. `CaptionCue.colorIndex`
alternates `0`/`1` per word group across the whole transcript (not reset
per segment). `toASS` emits an `.ass` (Advanced SubStation Alpha) file —
plain SRT/VTT can't express per-cue color or a heavy stroke; ffmpeg's
`subtitles` filter (used by `rendering/`) accepts `.ass` directly, so no
changes were needed there.

## Not yet implemented

- Speaker-name prefixes (`[Speaker 1]:`) when diarization is available.
- Multi-language caption tracks from a single transcript.
- Karaoke mode doesn't currently vary word-group size by emphasis (e.g. a
  single punchy word held longer) — it's a fixed `wordsPerCue` window.
