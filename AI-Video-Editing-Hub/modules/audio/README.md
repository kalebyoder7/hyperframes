# audio

Status: **Real / functional** for loudness normalization. Everything else
listed under "Not yet implemented" is a stub.

Two-pass EBU R128 loudness normalization (`normalizeAudio`) via ffmpeg's
`loudnorm` filter — measures actual input loudness in pass 1, then applies
correction using those measurements in pass 2, per ffmpeg's documented
best-practice for this filter.

## Requirements

- `ffmpeg` on `PATH`.

## API

```ts
import { normalizeAudio } from "./src/index.js";

await normalizeAudio("/path/in.mp4", "/path/out.mp4");
```

## Design notes

- `buildFirstPassArgs` / `buildSecondPassArgs` / `parseLoudnormMeasurement`
  are pure functions, unit-tested independent of a real ffmpeg binary.
- Default target: -16 LUFS integrated / -1.5 dBTP true peak / 11 LU range —
  a common social/short-form target (broadcast specs like ATSC A/85 typically
  target -24 LUFS instead; pass a custom `target` for that).

## Not yet implemented

- Noise reduction / de-essing / voice isolation.
- Auto-ducking music under speech.
- Silence trimming (dead air removal) — currently out of scope; `clip-selection/`
  implicitly avoids near-silent segments via its scoring, but doesn't trim
  silence within a kept segment.
