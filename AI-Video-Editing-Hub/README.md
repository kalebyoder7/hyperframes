# AI Video Editing Hub

A modular AI post-production system: import long-form video, transcribe it,
understand the conversation, detect compelling moments, edit clips
automatically, generate captions, generate motion graphics, color-grade, and
export platform-specific videos.

This lives inside the [hyperframes](../README.md) monorepo but is a
standalone project (its own `package.json`, not a bun workspace member) —
see `docs/architecture/overview.md` for why, and for how it reuses
hyperframes' own HTML-to-video renderer for motion graphics rather than
duplicating it.

## Status

This is an early, honestly-scoped implementation. Read
`docs/roadmap/roadmap.md` before assuming a capability exists — modules are
individually marked real/functional, partial, or interface-only. The MVP
pipeline (ingest → transcribe → detect highlights → build timeline →
caption → render → normalize audio) is real and end-to-end runnable; several
modules (speaker diarization, platform publishing uploads, LUT-based color
grading) are interfaces without a working implementation yet.

## Quick start

```bash
cd AI-Video-Editing-Hub
bun install
bun test                 # full unit test suite — no ffmpeg/API keys required
bun scripts/pipeline.ts --input /path/to/source.mp4 --platform tiktok

# or apply a named creative style preset instead of individual flags:
bun scripts/pipeline.ts --input /path/to/source.mp4 --config configs/nab-style.config.json
```

Requirements for an actual pipeline run (not for `bun test`): `ffmpeg`/
`ffprobe` on `PATH`, and `OPENAI_API_KEY` (or a local whisper.cpp setup) for
transcription. See `docs/architecture/pipeline.md` for the full flag
reference and requirements matrix, and `docs/creative/nab-style-guide.md`
for what the `nab-style` config preset encodes and why.

### Via Claude Code

`/render-social-clip <input-video-path> [platform]` — defined in
[`skills/render-social-clip/SKILL.md`](../skills/render-social-clip/SKILL.md)
at the repo root (installable via `npx skills add heygen-com/hyperframes
--skill render-social-clip`, same mechanism as the HyperFrames skills, but
deliberately kept out of that catalog since it's a different tool). Runs the
pipeline with the `nab-style` preset and then walks through the style
guide's non-automated rules (B-roll/visual-suggestion placement, comedic
rhythm-breakers, color-grade beats) as a shot list — use this instead of the
raw `bun scripts/pipeline.ts` invocation when you want the full creative SOP
applied, not just the automatable defaults.

## Layout

```
docs/
  architecture/     — system design, module interfaces, how to run the pipeline
  creative/         — style guides derived from reference material (e.g. nab-style-guide.md)
  roadmap/          — what's real vs. stub, next steps
modules/            — one directory per capability, each with src/ + tests/ + README.md
shared/             — cross-module types, logger, error classes, exec wrapper, config loader
configs/            — pipeline configs: default.config.json, nab-style.config.json, platform export presets (reference copy)
prompts/            — LLM prompt templates used by story-analysis
scripts/
  pipeline.ts       — the end-to-end orchestrator (reference CLI entry point)
tests/              — cross-module/integration tests (module-level tests live under each module)
assets/             — local scratch space for source media (gitignored)
exports/            — pipeline job output (gitignored)
logs/               — pipeline event log (gitignored)
```

## Modules

| Module                                                 | What it does                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| [`video-ingest`](modules/video-ingest/README.md)       | Probes and validates a source video (ffprobe)                            |
| [`transcription`](modules/transcription/README.md)     | Speech-to-text (OpenAI Whisper API or local whisper.cpp)                 |
| [`story-analysis`](modules/story-analysis/README.md)   | Scene detection, speaker detection (placeholder), LLM narrative analysis |
| [`clip-selection`](modules/clip-selection/README.md)   | Offline heuristic highlight/moment detection                             |
| [`timeline`](modules/timeline/README.md)               | Builds an edit-decision-list from selected highlights                    |
| [`captioning`](modules/captioning/README.md)           | Generates SRT/VTT captions, timeline-aware                               |
| [`motion-graphics`](modules/motion-graphics/README.md) | Overlay generation (hands off to hyperframes for rendering)              |
| [`audio`](modules/audio/README.md)                     | Loudness normalization, audio extraction                                 |
| [`color`](modules/color/README.md)                     | Basic color presets via ffmpeg `eq` filter                               |
| [`rendering`](modules/rendering/README.md)             | Final export: trim/concat/scale/caption-burn via ffmpeg                  |
| [`publishing`](modules/publishing/README.md)           | Platform preset validation (upload integrations not implemented)         |
| [`analytics`](modules/analytics/README.md)             | Local pipeline event tracking (JSONL)                                    |

## Contributing to a module

Every module follows the same shape: `src/index.ts` is the public barrel
export, `tests/` mirrors it 1:1, `README.md` states current status and what's
explicitly not implemented. Keep that pattern — it's what makes "is this
real or a stub" answerable in ten seconds per module.
