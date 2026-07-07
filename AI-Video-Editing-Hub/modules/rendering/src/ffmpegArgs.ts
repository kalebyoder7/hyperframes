import type { RenderJob } from "../../../shared/src/types.js";

export interface BuildFfmpegArgsOptions {
  burnSubtitlesPath?: string;
}

interface FilterGraph {
  filterComplex: string;
  videoLabel: string;
  audioLabel: string | null;
}

// Builds the ffmpeg filter_complex graph that trims each timeline clip out of
// the source, concatenates them in order, scales/pads to the export preset's
// aspect ratio, and (optionally) burns in an SRT subtitle track. Pure
// string-building — no I/O — so it's fully unit-testable without ffmpeg
// installed.
export function buildFilterGraph(
  job: RenderJob,
  options: BuildFfmpegArgsOptions = {},
): FilterGraph {
  const { asset, timeline, preset } = job;
  const clips = [...timeline.clips].sort((a, b) => a.order - b.order);
  if (clips.length === 0) {
    throw new Error("cannot render a timeline with zero clips");
  }

  const segmentFilters: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];

  clips.forEach((clip, i) => {
    const vLabel = `v${i}`;
    videoLabels.push(vLabel);
    segmentFilters.push(
      `[0:v]trim=start=${clip.sourceStart}:end=${clip.sourceEnd},setpts=PTS-STARTPTS[${vLabel}]`,
    );
    if (asset.hasAudio) {
      const aLabel = `a${i}`;
      audioLabels.push(aLabel);
      segmentFilters.push(
        `[0:a]atrim=start=${clip.sourceStart}:end=${clip.sourceEnd},asetpts=PTS-STARTPTS[${aLabel}]`,
      );
    }
  });

  const hasAudio = asset.hasAudio;
  const concatInputs = hasAudio
    ? clips.map((_, i) => `[v${i}][a${i}]`).join("")
    : videoLabels.map((l) => `[${l}]`).join("");
  const concatFilter = `${concatInputs}concat=n=${clips.length}:v=1:a=${hasAudio ? 1 : 0}[vout]${
    hasAudio ? "[aout]" : ""
  }`;

  const scaleFilter =
    `[vout]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,` +
    `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:color=black[vscaled]`;

  let finalVideoLabel = "vscaled";
  const filters = [...segmentFilters, concatFilter, scaleFilter];

  if (options.burnSubtitlesPath) {
    const escaped = escapeSubtitlesPath(options.burnSubtitlesPath);
    filters.push(`[vscaled]subtitles='${escaped}'[vfinal]`);
    finalVideoLabel = "vfinal";
  }

  return {
    filterComplex: filters.join(";"),
    videoLabel: `[${finalVideoLabel}]`,
    audioLabel: hasAudio ? "[aout]" : null,
  };
}

// ffmpeg's subtitles filter parses its argument with its own mini-syntax
// where `:` and `\` and `'` are special — escape them so absolute paths
// (which contain `:` on Windows, and may contain spaces anywhere) survive.
export function escapeSubtitlesPath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function buildFfmpegArgs(job: RenderJob, options: BuildFfmpegArgsOptions = {}): string[] {
  const graph = buildFilterGraph(job, options);
  const maps = [graph.videoLabel, ...(graph.audioLabel ? [graph.audioLabel] : [])];

  const args = [
    "-y",
    "-i",
    job.asset.path,
    "-filter_complex",
    graph.filterComplex,
    ...maps.flatMap((m) => ["-map", m]),
    "-r",
    String(job.preset.fps),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
  ];

  if (graph.audioLabel) {
    args.push("-c:a", "aac", "-b:a", "192k");
  } else {
    args.push("-an");
  }

  args.push(job.outputPath);
  return args;
}
