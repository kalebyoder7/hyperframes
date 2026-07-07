# NAB creative style guide (v1 — derived from reference reels)

**Status: v1, derived empirically from four reference shorts the team
provided directly as video files.** The team also mentioned a text-message
SOP with specific stipulations/workflow process — that text hasn't arrived
in this session yet. This doc is the video-analysis half only; when the SOP
text comes in, merge it in as a "Team stipulations" section below rather
than overwriting these findings, since the two should agree on most points
and the SOP text may add rules no video could show (e.g. legal/brand
constraints, source-selection rules, approval workflow).

## How this was produced

Not guessed, not watched-and-described — measured. ffmpeg scene-cut
detection extracted real shot-boundary timestamps from each file, frame
contact sheets were sampled across each timeline and visually reviewed, and
waveform/spectrogram analysis characterized the audio. See
`AI-Video-Editing-Hub/scripts/` for the reusable analysis approach (scene
detection via `select='gt(scene,0.28)'`, frame contact sheets via a `tile`
filter, `showwavespic`/`showspectrumpic` for audio) — worth turning into a
proper module if this kind of reference analysis becomes a recurring need.

## Reference set

| Video | Duration | Shots | Cuts/min | Avg shot length | Shot length range |
|---|---|---|---|---|---|
| FIFA hydration breaks | 42.5s | 29 | 39.5 | 1.47s | 0.25s–4.09s |
| Bible/gods | 48.1s | 22 | 26.2 | 2.19s | 0.5s–4.8s |
| Billionaires/weather | 63.3s | 30 | 27.5 | 2.11s | 0.25s–7.38s |
| Skinwalker story | 75.0s | 49 | 38.4 | 1.53s | 0.04s–3.92s |

## Pacing

Target **1.5–2.2s average shot length**, i.e. roughly **27–40 cuts per
minute**. This is 2–3x faster than an unedited talking-head cut. Concretely:

- Sub-0.5s flash-cuts are used for emphasis/punch, not just as noise.
- Occasional 4–7s "dwell" shots are reserved for a single strong image
  (hero shot of an object, a creature reveal) — pacing isn't uniformly
  fast, it's fast-with-deliberate-holds.
- The faster of the two "commentary" videos (FIFA, 39.5 cuts/min) tracks
  denser, punchier speech; the two slower ones (Bible, weather — ~26–28
  cuts/min) let B-roll breathe more, consistent with more voiceover-driven,
  explanatory pacing vs. reactive commentary pacing.

## Captions

Word-by-word or short-phrase "karaoke" style:

- Bold sans-serif, heavy black stroke/outline for legibility over any
  background.
- **Two-tone color alternation** per word or short phrase — the specific
  color pair changes per video (green/white, purple/orange, white/orange
  observed) but the alternating-pair *format* is a fixed house style.
- Position: lower-third by default, shifting toward center when the shot
  composition calls for it (e.g. a mostly-empty upper frame).
- Timing is tightly synced to speech — captions change on essentially every
  spoken word or short phrase, not per sentence.

This is a materially different rhythm from a standard subtitle track (one
phrase every few seconds); it reads more like a lyric video than a caption
track.

## Visual assets: AI-generated, historic/archival, and real footage

Three distinct patterns depending on subject matter — **match the asset
type to the claim being made**, don't default to one look:

1. **Mythological / speculative / illustrative content** (e.g. the Bible
   video): fully AI-generated cinematic scenes — glowing figures, epic
   environments, imagery that doesn't and can't exist as a real photo. Used
   confidently and often, including compositing a generated element
   directly onto the live host (a floating idol on the host's shoulder).
2. **Horror / creature / story content** (e.g. the skinwalker video):
   AI-generated creature/character renders as the literal visual payoff of
   a story beat, paired with deliberately moody, desaturated,
   blurred-for-dread stock-style B-roll (silhouette in fog, teal grade) for
   atmosphere in between.
3. **Current-events / conspiracy-adjacent content** (e.g. the weather
   video): **real** news screenshots and press-style photography (including
   a grainy black-and-white portrait), mixed with an obviously-composited
   "shadowy figures + graphic overlay" conspiracy-style image. The real and
   the composited are both present but visually distinct — the composite
   doesn't try to pass as a real photo.

Rule of thumb: AI generation fills gaps where no real image could exist or
where a story needs a literal monster/scene; real archival/press material
is used where the claim's credibility depends on it being real; composited
graphics are for editorializing (villain framing, "agenda" visuals) and are
allowed to look designed rather than photographic.

## Color grading as a narrative device

Live hosts stay full color. A shift to **black-and-white or a cool
teal/desaturated grade** is used as a deliberate tonal marker for
"serious / historic / ominous" beats — seen at the emotional close of the
Bible video and on several B-roll inserts in the weather video. Treat a
grade shift as punctuation, not decoration: reserve it for the beat that
should feel heavier than what's around it.

A near-white flash-frame was also observed used as a hard transition/wipe
between shots — a cheap, effective punctuation device, used sparingly.

## Sound: dialogue-driven, not music-driven

Waveform analysis across all four files shows **near-continuous, dense
speech energy with no sustained music bed dominating the mix**. This is
VO/commentary-first editing — cuts are timed to speech, not to a music
grid. The one exception (skinwalker video) shows two louder emotional-beat
bursts and a brief hard silence immediately before a reveal — **silence as
punctuation before a beat** is a legitimate, deliberate tool, not dead air
to be filled.

Implication for SFX/music: keep a bed low and in service of dialogue; save
any music/SFX swell for a specific beat rather than running it continuously
under the whole edit.

## Comedic / meme rhythm-breakers

Every single reference video contains at least one comedic or meme-style
cutaway inserted into an otherwise serious or scary segment — a costume
cutaway, a person dancing, a host yelling in mock distress. This reads as a
deliberate house device: **plan at least one tonal break per short**,
timed against a natural beat in the narration, not randomly.

## Multi-host / multi-camera cutting

Even a single narrator's story cuts in reaction shots of other hosts from
different sets/cameras. Don't treat a story as belonging to one static
camera — cut to a reaction, even a silent one, to vary the frame and sell
the emotional beat.

## End cards

At least one reference (FIFA) closes on a **branded title/outro card** —
bold type treatment plus a key visual (the trophy) rather than just
hard-cutting to black. Worth treating as a template component, not a
one-off.

## How this maps onto the pipeline

- `configs/nab-style.config.json` encodes the pacing/caption defaults below
  as a selectable pipeline config (`--config configs/nab-style.config.json`
  on `scripts/pipeline.ts`):
  - `platform: "tiktok"` rather than `"youtube-shorts"` — 2 of the 4
    reference videos ran 63–75s, over youtube-shorts' 60s cap.
  - `idealClipMinSec: 2, idealClipMaxSec: 12` narrows `clip-selection`'s
    "does this spoken segment look like a complete standalone beat" window
    toward shorter, punchier statements, reflecting the observed preference
    for concision. **This tunes which transcript segments get kept — it is
    not the same thing as the 1.5–2.2s visual shot-length finding above**,
    which the pipeline doesn't automate (no B-roll insertion module exists
    yet; see `modules/motion-graphics/README.md`).
  - `captionColors: ["#39FF14", "#FFFFFF"]` is the most common pair observed
    (2 of 4 references); purple/orange and white/orange are equally valid
    per-video alternates — override per project rather than treating this
    one pair as mandatory.
- `modules/captioning`'s karaoke mode (`generateKaraokeCaptions` / `toASS`)
  implements the word-level two-tone caption style described above.
- `modules/story-analysis`'s `AnthropicStoryAnalyzer` now asks the model to
  suggest a visual treatment (`visualSuggestion`) per highlight — "AI-generated
  cinematic reenactment", "real archival photo", "reaction/meme insert",
  etc. — informed by the "match asset type to claim" rule above. This is a
  **suggestion only**: nothing in the hub currently sources, generates, or
  auto-inserts B-roll — see `modules/motion-graphics/README.md` and the
  roadmap for that gap.
- Color-grading-as-punctuation, comedic rhythm-breakers, multi-host cutting,
  and end cards are **not** encoded in the pipeline — they require either a
  human editor or a B-roll/reaction-shot library the hub doesn't have yet.
  Treat this doc as the spec for that future module rather than assuming
  it's automated today.

## Open: team SOP stipulations (pending)

Not yet received. When the team's text-message SOP arrives, add it here as
its own section and cross-reference/reconcile against the empirical
findings above rather than replacing them.
