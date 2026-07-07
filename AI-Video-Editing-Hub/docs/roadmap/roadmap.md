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
| captioning | ✅ | SRT/VTT (phrase) + word-level two-tone karaoke → ASS, timeline-aware re-basing |
| rendering | ✅ | ffmpeg trim/concat/scale/burn-in (SRT or ASS), libx264 only |
| audio | 🟡 | loudness normalization + extraction real; no denoise/ducking |
| color | 🟡 | basic eq-filter presets; no LUTs, no scene-aware matching |
| motion-graphics | 🟡 | one real template (lower-third → HyperFrames HTML) |
| publishing | 🟡 | preset validation real; no platform upload integrations |
| analytics | 🟡 | local JSONL pipeline-event sink; no platform metrics pull |

## Near-term (next session)

1. **Team SOP text stipulations** — `docs/creative/nab-style-guide.md` is v1,
   built entirely from empirical analysis of 4 reference videos (real
   ffmpeg scene-detection + frame sampling + waveform analysis, not
   guessing). The team's text-message SOP with additional
   stipulations/workflow process hasn't arrived yet — merge it into that
   doc as its own section when it does, reconciling against the empirical
   findings rather than replacing them.
2. **B-roll/reaction-shot insertion module** — the single biggest gap
   between the style guide and what the pipeline automates. The style guide
   measures a 1.5–2.2s average *visual* shot length (cuts to B-roll/reaction
   shots while the same speech continues) and documents AI-generated vs.
   real-archival vs. meme-insert asset selection — none of this is wired
   up; `story-analysis`'s new `visualSuggestion` field is advisory metadata
   only. This would need: a stock/B-roll asset source (or `media-use`-style
   AI image/video generation), a decision layer for *when* to cut to B-roll
   vs. hold on the speaker, and `motion-graphics`/`rendering` support for
   compositing a second visual layer over/instead of the base timeline.
3. **Speaker diarization** — pick one real provider (AssemblyAI is the
   lowest-integration-cost hosted option) and implement `SpeakerDetector`
   for real, following the same fetch-based pattern as
   `OpenAIWhisperProvider`.
4. **Visual scene-cut detection** — ffmpeg's `select='gt(scene,0.3)'` filter
   (the exact approach used to measure the reference videos for the style
   guide) can surface frame-difference cut points on the *source* footage;
   combine with the existing silence-gap heuristic in `story-analysis/`.
5. **First `PublishTarget` implementation** — YouTube Data API is the best
   documented OAuth flow of the four platforms; a working reference
   implementation there makes the second/third platform much faster.
6. **Remote/URL ingestion** in `video-ingest` (S3 signed URLs at minimum).

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
