# Roadmap

Status legend: ✅ real/functional · 🟡 real but partial · ⬜ interface only / not started

| Module | Status | Notes |
|---|---|---|
| video-ingest | ✅ | ffprobe-based, local files only |
| transcription | ✅ | OpenAI Whisper API + local whisper.cpp providers |
| clip-selection | ✅ | offline heuristic scorer, no external deps |
| story-analysis: scene detection | ✅ | silence-gap heuristic (text timing, not visual) |
| story-analysis: narrative analysis | ✅ | Anthropic-backed, alternative to clip-selection |
| story-analysis: speaker detection | ⬜ | `NoOpSpeakerDetector` placeholder only |
| timeline | ✅ | merge/pad/clamp EDL builder |
| captioning | ✅ | SRT/VTT, timeline-aware re-basing |
| rendering | ✅ | ffmpeg trim/concat/scale/burn-in, libx264 only |
| audio | 🟡 | loudness normalization + extraction real; no denoise/ducking |
| color | 🟡 | basic eq-filter presets; no LUTs, no scene-aware matching |
| motion-graphics | 🟡 | one real template (lower-third → HyperFrames HTML) |
| publishing | 🟡 | preset validation real; no platform upload integrations |
| analytics | 🟡 | local JSONL pipeline-event sink; no platform metrics pull |

## Near-term (next session)

1. **Speaker diarization** — pick one real provider (AssemblyAI is the
   lowest-integration-cost hosted option) and implement `SpeakerDetector`
   for real, following the same fetch-based pattern as
   `OpenAIWhisperProvider`.
2. **Visual scene-cut detection** — ffmpeg's `select='gt(scene,0.4)'`
   filter can surface frame-difference cut points; combine with the
   existing silence-gap heuristic in `story-analysis/`.
3. **First `PublishTarget` implementation** — YouTube Data API is the best
   documented OAuth flow of the four platforms; a working reference
   implementation there makes the second/third platform much faster.
4. **Remote/URL ingestion** in `video-ingest` (S3 signed URLs at minimum).

## Medium-term

- LUT-based color grading (`lut3d` ffmpeg filter) + per-scene color matching.
- Additional `motion-graphics` templates (stat card, data callout, pull-quote)
  reusing the same HyperFrames-HTML-emission approach as the lower-third.
- Cross-segment highlight merging in `clip-selection` (currently only
  `timeline/`'s gap-merge softens jump cuts; merging happens post-selection,
  not pre-scoring).
- Silence/dead-air trimming within kept segments (`audio/`).

## Explicitly out of scope for now

- A hosted/managed version of this pipeline (queueing, multi-tenant job
  storage, a UI) — this is a CLI + library today, matching the "Preferred
  Folder Structure" spec's `scripts/` + `modules/` shape.
- Hardware-accelerated encoding.
- HDR / high-bit-depth color pipelines.
