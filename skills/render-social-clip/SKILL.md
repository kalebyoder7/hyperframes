---
name: render-social-clip
description: 'Render raw footage into a finished, NAB-style social media clip. Runs the AI-Video-Editing-Hub pipeline (ingest, transcribe, highlight-detect, caption, render, normalize) with the nab-style creative preset applied, then produces a shot list for the SOP rules the pipeline cannot automate yet (B-roll/visual-suggestion placement, comedic rhythm-breakers, color-grade beats). Trigger on "render this footage into a short/reel/clip", "cut this down for social", "make a NAB-style clip from this video", or any request to turn raw footage into a finished social export using AI-Video-Editing-Hub. This is a separate tool from HyperFrames (HTML-to-video composition) — do not route here for "make me a promo/explainer/composition" requests, use the hyperframes skill for those.'
metadata:
  tags: ai-video-editing-hub, social-clip, nab, pacing, captions, ffmpeg, whisper, highlight-detection
---

# Render social clip (AI-Video-Editing-Hub)

Produces a finished social clip from raw footage using
`AI-Video-Editing-Hub/`, following the house creative style documented in
`AI-Video-Editing-Hub/docs/creative/nab-style-guide.md`. That doc is the
source of truth for pacing, captions, visual-asset rules, color grading,
sound, and comedic-insert conventions — read it now if you haven't already
this session, including its "Open: team SOP stipulations" section (the
team's text-message SOP may have been merged in since this skill was
written; if it's still marked pending, proceed on the empirical findings
alone and say so in your summary).

This is a distinct tool from HyperFrames itself (the parent repo's
HTML-to-video renderer) — it lives entirely under `AI-Video-Editing-Hub/`
and is invoked via its own `bun scripts/pipeline.ts` CLI, not via
`npx hyperframes`.

Arguments: `<input-video-path> [platform]` — platform defaults to `tiktok`
(one of `tiktok`, `youtube-shorts`, `instagram-reels`, `youtube-landscape`,
`linkedin`; see `AI-Video-Editing-Hub/modules/rendering/src/presets.ts`).

## Steps

1. **Preflight.** Confirm the input video path exists. Confirm
   `ffmpeg`/`ffprobe` are on `PATH` (`which ffmpeg ffprobe`) — install if
   missing (`apt-get install -y --no-install-recommends ffmpeg` on
   Debian/Ubuntu) rather than skipping ahead and hitting an opaque failure
   mid-pipeline. Confirm `AI-Video-Editing-Hub/node_modules` exists; if not,
   run `bun install` there first.

2. **Run the automated pipeline** from `AI-Video-Editing-Hub/`:

   ```bash
   bun scripts/pipeline.ts \
     --input "<input-video-path>" \
     --config configs/nab-style.config.json \
     --platform "<platform, default tiktok>" \
     --story-analyzer anthropic
   ```

   This applies the style guide's *measurable* defaults automatically:
   punchy highlight selection tuned toward shorter standalone beats
   (`idealClipMinSec: 2, idealClipMaxSec: 12`), word-level two-tone karaoke
   captions burned in as ASS, a tiktok-range duration budget, and loudness
   normalization. If `ANTHROPIC_API_KEY` isn't set, `--story-analyzer
   anthropic` will fail — fall back to `--story-analyzer heuristic` (drop
   that flag) and say so; the heuristic path still applies pacing/captions
   correctly, it just won't get per-highlight `visualSuggestion` metadata.
   Same idea if `OPENAI_API_KEY` is unset for transcription — offer
   `--transcription local` (requires `WHISPER_CPP_BIN`/`WHISPER_CPP_MODEL`)
   as the alternative and explain the tradeoff rather than silently
   failing.

3. **Read the job artifacts** the pipeline wrote to
   `AI-Video-Editing-Hub/exports/<jobId>/`: `story-analysis.json` (summary +
   narrative arc, if the anthropic analyzer ran), `highlights.json` (each
   highlight's `reasons` and, if present, `visualSuggestion`), and
   `timeline.json`. Use these to ground the manual pass in step 4 — don't
   invent visual/creative direction the analysis didn't actually suggest.

4. **Apply the SOP's non-automated rules.** The pipeline does NOT insert
   B-roll, reaction shots, meme cutaways, or color-grade shifts (see
   `AI-Video-Editing-Hub/docs/roadmap/roadmap.md`'s "B-roll/reaction-shot
   insertion module" gap). For this run, don't try to composite them —
   instead produce a **shot list** the human editor (or a follow-up session
   once a B-roll module exists) can act on, covering:
   - Where each `visualSuggestion` should be inserted (timestamp on the
     *trimmed* timeline, from `timeline.json`), and whether it calls for an
     AI-generated reenactment, a real archival/press image, or a
     creature/character render, per the style guide's asset-matching rule.
   - One or two candidate spots for a comedic/meme rhythm-breaker — pick a
     natural beat, don't force one into every highlight.
   - Any beat that should get a color-grade shift (B&W/desaturate/cool
     grade) as a tonal marker, per the style guide.
   - Whether an end card/outro is warranted for this platform/duration.

5. **Report**: final export path (`final.mp4` if normalized, else
   `draft.mp4`), the platform preset validation result (from the pipeline's
   own `validateAgainstPreset` check — flag any duration/resolution
   mismatch), and the shot list from step 4. Be explicit about what was
   fully automated versus what still needs a human (or a future B-roll
   module) to execute.
