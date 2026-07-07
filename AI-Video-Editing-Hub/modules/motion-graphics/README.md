# motion-graphics

Status: **One real template (`generateLowerThirdClip`); the general
"Motion Graphics" + "Animation Rendering" core modules from the spec are
not implemented.**

## Why hand off to hyperframes instead of reinventing rendering

This repo (`hyperframes`, the parent of `AI-Video-Editing-Hub/`) is itself
an HTML-to-video rendering framework — `data-*` timing attributes, GSAP
timelines, seek-by-frame capture. Rather than building a second motion
graphics/animation engine inside this hub, the intended architecture is:
this module emits **HyperFrames-compatible composition HTML** (clips with
`class="clip"` and `data-start`/`data-duration`), and rendering is deferred
to the sibling `packages/engine` + `packages/producer` pipeline. See the
root `CLAUDE.md` and `/hyperframes-core` skill for the composition contract.

`generateLowerThirdClip` is a real, working first slice of that: a
CSS-keyframe slide-in/out lower-third, parameterized by title/subtitle/
timing/accent color.

## API

```ts
import { generateLowerThirdClip } from "./src/index.js";

const clipHtml = generateLowerThirdClip({
  title: "Jane Doe",
  subtitle: "Product Lead",
  startSec: 4,
  durationSec: 3.5,
});
```

## Not yet implemented

- Kinetic titles, data callouts, pull-quotes, side panels, PiP — the full
  scope of hyperframes' own `/talking-head-recut` skill; that skill is the
  more complete implementation of this exact problem and should be reused
  rather than duplicated.
- Auto-placement/timing derived from transcript + highlight data (currently
  the caller supplies start/duration manually).
- A `MotionGraphicsGenerator` implementation — the interface exists as a
  contract for future template types (data callout, stat card, etc.) to
  implement alongside the lower-third.
