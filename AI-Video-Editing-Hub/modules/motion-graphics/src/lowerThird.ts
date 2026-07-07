export interface LowerThirdSpec {
  title: string;
  subtitle?: string;
  startSec: number;
  durationSec: number;
  accentColor?: string;
}

// Generates a HyperFrames-compatible HTML clip for a lower-third overlay —
// a small, real, functional slice of motion-graphics generation that ties
// this module to the parent hyperframes repo's own HTML-to-video renderer
// (see ../../../../packages/engine), rather than reinventing a rendering
// engine here. This one template (CSS-keyframe slide-in/out) is real; the
// broader "invent any motion graphic from a spec" capability described in
// the module README is not.
export function generateLowerThirdClip(spec: LowerThirdSpec): string {
  const accent = spec.accentColor ?? "#4f46e5";
  const subtitleHtml = spec.subtitle
    ? `<div class="subtitle">${escapeHtml(spec.subtitle)}</div>`
    : "";

  return `<div class="clip lower-third" data-start="${spec.startSec}" data-duration="${spec.durationSec}">
  <style>
    .lower-third { position: absolute; left: 4%; bottom: 8%; font-family: system-ui, sans-serif; }
    .lower-third .bar { width: 6px; background: ${accent}; display: inline-block; height: 100%; }
    .lower-third .content {
      display: inline-block;
      background: rgba(15, 15, 20, 0.85);
      color: white;
      padding: 0.6em 1em;
      transform: translateX(-100%);
      animation: lower-third-in 0.4s ease-out forwards, lower-third-out 0.4s ease-in forwards;
      animation-delay: 0s, ${Math.max(0, spec.durationSec - 0.4)}s;
    }
    .lower-third .title { font-size: 1.4rem; font-weight: 700; margin: 0; }
    .lower-third .subtitle { font-size: 1rem; opacity: 0.8; margin: 0; }
    @keyframes lower-third-in { to { transform: translateX(0); } }
    @keyframes lower-third-out { to { transform: translateX(-100%); } }
  </style>
  <div class="bar"></div>
  <div class="content">
    <div class="title">${escapeHtml(spec.title)}</div>
    ${subtitleHtml}
  </div>
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
