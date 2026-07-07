# Architecture Overview

AI-Video-Editing-Hub is a modular AI post-production system: import a
long-form video, transcribe it, understand its narrative, detect compelling
moments, edit them into a timeline, caption and render a platform-ready
export.

## Design principles

- **Every module is independently testable.** Modules that shell out to
  external binaries (`ffmpeg`, `ffprobe`, whisper.cpp) or call network APIs
  (OpenAI, Anthropic) split pure logic (command/prompt building, response
  parsing) from the I/O call, and accept an injectable `exec`/`fetch`
  function. This is why the whole test suite (81 tests as of this writing)
  runs green in a sandbox with no ffmpeg, no API keys, and no network.
- **A shared data contract, not shared state.** Every module reads/writes
  only the types in `shared/src/types.ts` (`VideoAsset`, `Transcript`,
  `HighlightSegment`, `Timeline`, `CaptionCue`, `RenderJob`, ...). No module
  imports another module's internals — cross-module calls go through each
  module's `src/index.ts` barrel export.
- **Honest module status.** Every module README states plainly what's real
  and functional versus an interface-only stub versus not yet started. See
  `docs/roadmap/roadmap.md` for the consolidated view.
- **Reuse the parent repo where it already solves the problem.**
  `AI-Video-Editing-Hub` lives inside `hyperframes`, which is itself an
  HTML-to-video rendering framework. `motion-graphics/` deliberately emits
  HyperFrames-compatible composition HTML rather than building a second
  rendering engine — see that module's README.

## Data flow (MVP pipeline)

```
source.mp4
   │
   ▼
video-ingest ──────────► VideoAsset (ffprobe metadata)
   │
   ▼
transcription ─────────► Transcript (OpenAI Whisper API, or local whisper.cpp)
   │
   ├──────────────────────────────────┐
   ▼                                  ▼
clip-selection                 story-analysis (optional, LLM-backed)
(offline heuristic scorer)     (AnthropicStoryAnalyzer)
   │                                  │
   └────────────► HighlightSegment[] ◄┘
                       │
                       ▼
                   timeline ─────────► Timeline (merged, ordered clips)
                       │
                       ▼
                  captioning ────────► CaptionCue[] (re-based onto Timeline)
                       │
                       ▼
                  rendering ──────────► draft.mp4 (trim/concat/scale/burn-in via ffmpeg)
                       │
                       ▼
                    audio ────────────► final.mp4 (loudness-normalized)
                       │
                       ▼
                 publishing (validate only — no upload integration yet)
```

`scripts/pipeline.ts` is the reference orchestrator wiring all of the above.
`color/` and `motion-graphics/` are available but not wired into the default
pipeline run — they're invoked as optional post-processing steps.

## Module map

See `docs/architecture/module-interfaces.md` for each module's public API,
and the "Core Modules" list in the root `CLAUDE.md` for how each named
module from the original spec maps onto `modules/*`:

| Spec module          | Lives in                          |
|-----------------------|-----------------------------------|
| Video Import           | `modules/video-ingest`            |
| Media Processing        | `modules/video-ingest`, `modules/audio` |
| Transcription           | `modules/transcription`           |
| Speaker Detection        | `modules/story-analysis` (placeholder) |
| Scene Detection          | `modules/story-analysis`          |
| Story Analysis           | `modules/story-analysis`          |
| Highlight Detection      | `modules/clip-selection`          |
| Timeline Builder         | `modules/timeline`                |
| Caption Generator        | `modules/captioning`              |
| Motion Graphics          | `modules/motion-graphics` (one template) |
| Animation Rendering      | `modules/motion-graphics` (hands off to hyperframes) |
| Color Pipeline           | `modules/color`                   |
| Audio Enhancement        | `modules/audio`                   |
| Export Engine            | `modules/rendering`               |
| Publishing               | `modules/publishing` (validation only) |
| Analytics                | `modules/analytics`               |
