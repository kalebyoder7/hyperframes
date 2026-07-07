# rendering (export engine)

Status: **Real / functional.**

Renders a `Timeline` + `CaptionCue[]` down to a platform-ready MP4 via
`ffmpeg`: trims each timeline clip out of the source, concatenates them,
scales/pads to the target platform's aspect ratio (`presets.ts`), and
optionally burns in captions as an SRT subtitle track.

## Requirements

- `ffmpeg` on `PATH`.

## API

```ts
import { renderTimeline, getPreset } from "./src/index.js";

const outputPath = await renderTimeline({
  id: "job-1",
  asset,
  timeline,
  captions,
  preset: getPreset("youtube-shorts"),
  outputPath: "../exports/job-1.mp4",
});
```

## Design notes

- `buildFilterGraph` / `buildFfmpegArgs` are pure string-building functions
  with **no I/O** — they construct the `ffmpeg -filter_complex` graph and
  full argument list as plain data. This is what makes the module unit
  testable in a sandbox without ffmpeg installed: tests assert on the
  constructed args, not on an actual render.
- `exec` is injectable (`RenderOptions.exec`) for the same reason, and reused
  by `scripts/pipeline.ts` end to end.
- Subtitle paths are escaped for ffmpeg's `subtitles` filter mini-syntax
  (`escapeSubtitlesPath`), which otherwise breaks on `:` (common in absolute
  paths) and embedded quotes.

## Not yet implemented

- Hardware-accelerated encode paths (VideoToolbox/NVENC/QSV) — currently
  always `libx264`.
- Transition effects between merged clips (hard cuts only).
- Multi-pass encoding / target-bitrate mode (currently constant CRF).
