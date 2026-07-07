# AI Video Editing Hub — engineering notes

This directory is a standalone project inside the `hyperframes` monorepo
(own `package.json`, not a bun workspace member — the root `package.json`'s
`workspaces` glob is `packages/*`, which does not reach here).

## Build & test

```bash
cd AI-Video-Editing-Hub
bun install
bun test          # bun:test, all modules — no ffmpeg/API keys required
bun run typecheck # tsc --noEmit
```

## Conventions

- **Module shape**: every `modules/<name>/` has `src/index.ts` (public
  barrel export — other modules and `scripts/pipeline.ts` only import from
  here, never from a module's internal files), `tests/`, and a `README.md`
  stating real/partial/stub status plus a "Not yet implemented" list. Keep
  that list honest and current — it's the fastest way to answer "does X
  work yet" without reading source.
- **I/O is injectable.** Anything that shells out (`ffmpeg`, `ffprobe`,
  whisper.cpp) takes an `exec: ExecFn` option (`shared/src/exec.ts`).
  Anything that calls a network API takes a `fetchFn: typeof fetch` option.
  Default to `realExec`/global `fetch`, but this is what lets the full test
  suite run without any of those installed/configured. Preserve this
  pattern in new modules.
- **Pure logic split from I/O.** Command-building (`buildFfmpegArgs`),
  prompt-building (`buildPrompt`), and response-parsing
  (`parseLoudnormMeasurement`, `mapToTranscript`) are separate exported
  functions from the async I/O-performing function that calls them. Test
  the pure functions directly; test the I/O function with an injected fake.
- **Shared types only.** Cross-module data exchange goes through
  `shared/src/types.ts`. Don't import one module's internal types from
  another module.
- **Errors**: extend `PipelineError` (`shared/src/errors.ts`) or a
  module-local subclass of it, so `scripts/pipeline.ts`'s stage wrapper can
  log/track failures uniformly.

## Adding a new module

1. `modules/<name>/{src,tests}`.
2. `src/index.ts` barrel export.
3. `README.md`: one status line at the top, API section, "Not yet
   implemented" section.
4. Wire into `scripts/pipeline.ts` only if it belongs in the default
   end-to-end run — optional/manual steps (e.g. `color/`) don't need to be.
5. Update `docs/architecture/overview.md`'s module map table and
   `docs/roadmap/roadmap.md`'s status table.

## Do not

- Do not add a module-level `package.json` — this is a single-package
  project; `modules/*` are directories, not workspace packages.
- Do not hardcode API keys, model IDs as permanent defaults without an env
  override, or file paths outside this directory.
- Do not claim a module is "done" in its README when it's an interface with
  no implementation — see the existing READMEs for the expected honesty
  level (e.g. `publishing/README.md`, `story-analysis/README.md`).
