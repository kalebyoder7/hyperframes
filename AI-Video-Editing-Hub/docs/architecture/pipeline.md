# Running the pipeline

## Requirements

- `bun` (already required by the parent `hyperframes` repo).
- `ffmpeg` / `ffprobe` on `PATH` — required for ingest, rendering, and audio
  normalization.
- `OPENAI_API_KEY` — for the default (`openai`) transcription provider.
  Alternatively `WHISPER_CPP_BIN` + `WHISPER_CPP_MODEL` for fully offline
  transcription via `--transcription local`.
- `ANTHROPIC_API_KEY` — only if running with `--story-analyzer anthropic`.
  The default `heuristic` story analyzer needs no API key.

## Setup

```bash
cd AI-Video-Editing-Hub
bun install
```

## Run

```bash
bun scripts/pipeline.ts --input /path/to/source.mp4 --platform tiktok
```

Full option list is documented at the top of `scripts/pipeline.ts`. Key ones:

| Flag | Default | Notes |
|---|---|---|
| `--platform` | `youtube-shorts` | any key in `modules/rendering/src/presets.ts` |
| `--target-duration` | `60` | seconds; soft budget for highlight selection |
| `--min-score` | `0.35` | highlight score threshold (heuristic mode only) |
| `--transcription` | `openai` | `openai` or `local` |
| `--story-analyzer` | `heuristic` | `heuristic` (offline) or `anthropic` (LLM) |
| `--no-captions` | off | skip caption generation + burn-in |
| `--no-normalize` | off | skip the audio loudness-normalization pass |
| `--out-dir` | `../exports` | job artifacts land in `<out-dir>/<jobId>/` |

## Output

Each run writes to `exports/<jobId>/`:

- `transcript.json`, `highlights.json`, `timeline.json` — intermediate
  pipeline artifacts, useful for debugging a bad edit decision.
- `captions.srt` / `captions.vtt`
- `draft.mp4` — rendered, captioned export before normalization
- `final.mp4` — loudness-normalized export (this is the deliverable, when
  `--no-normalize` isn't set)

Pipeline stage timing/success/failure events are appended to
`logs/pipeline-events.jsonl` (via `modules/analytics`).

## Testing without ffmpeg/API keys

`bun test` from `AI-Video-Editing-Hub/` runs the full unit test suite
without any of the above installed — every module that shells out or calls
a network API has its I/O layer injected out in tests. Running
`scripts/pipeline.ts` itself against a real video does require ffmpeg and a
transcription credential.
