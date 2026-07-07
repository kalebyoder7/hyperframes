# color

Status: **Real but basic.** Applies simple, explainable brightness / contrast
/ saturation / gamma presets via ffmpeg's `eq` filter — this is auto color
_correction_, not a color _grading_ pipeline.

## Presets

`flat` (no-op passthrough, re-encode only), `warm`, `cool`, `punchy` — see
`src/presets.ts` for exact values.

## Requirements

- `ffmpeg` on `PATH`.

## API

```ts
import { applyColorPreset } from "./src/index.js";

await applyColorPreset("/path/in.mp4", "/path/out.mp4", "punchy");
```

## Not yet implemented

- `.cube` LUT loading/application (ffmpeg's `lut3d` filter would be the
  mechanism — deliberately not wired up yet).
- Waveform/histogram-driven automatic exposure correction.
- Per-shot (scene-boundary-aware) color matching across cuts.
- HDR tone-mapping.
