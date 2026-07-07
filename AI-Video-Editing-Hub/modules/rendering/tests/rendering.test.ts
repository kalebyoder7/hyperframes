import { describe, expect, test } from "bun:test";
import { buildFfmpegArgs, buildFilterGraph, escapeSubtitlesPath } from "../src/ffmpegArgs.js";
import { getPreset, EXPORT_PRESETS } from "../src/presets.js";
import { renderTimeline } from "../src/index.js";
import type { RenderJob, VideoAsset } from "../../../shared/src/types.js";

function asset(overrides: Partial<VideoAsset> = {}): VideoAsset {
  return {
    id: "asset-1",
    path: "/tmp/source.mp4",
    durationSec: 100,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    codec: "h264",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function job(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: "job-1",
    asset: asset(),
    timeline: {
      id: "tl-1",
      sourceAssetId: "asset-1",
      clips: [
        { id: "c0", sourceStart: 0, sourceEnd: 5, order: 0 },
        { id: "c1", sourceStart: 10, sourceEnd: 15, order: 1 },
      ],
      totalDurationSec: 10,
    },
    captions: [],
    preset: getPreset("youtube-shorts"),
    outputPath: "/tmp/out.mp4",
    ...overrides,
  };
}

describe("presets", () => {
  test("all platforms have a registered preset", () => {
    for (const platform of Object.keys(EXPORT_PRESETS)) {
      expect(getPreset(platform as never)).toBeDefined();
    }
  });

  test("vertical platforms are 9:16", () => {
    for (const p of ["tiktok", "youtube-shorts", "instagram-reels"] as const) {
      const preset = getPreset(p);
      expect(preset.width / preset.height).toBeCloseTo(9 / 16, 2);
    }
  });
});

describe("buildFilterGraph", () => {
  test("trims and concatenates clips with audio", () => {
    const graph = buildFilterGraph(job());
    expect(graph.filterComplex).toContain("trim=start=0:end=5");
    expect(graph.filterComplex).toContain("trim=start=10:end=15");
    expect(graph.filterComplex).toContain("atrim=start=0:end=5");
    expect(graph.filterComplex).toContain("concat=n=2:v=1:a=1");
    expect(graph.audioLabel).toBe("[aout]");
  });

  test("omits audio filters when asset has no audio", () => {
    const graph = buildFilterGraph(job({ asset: asset({ hasAudio: false }) }));
    expect(graph.filterComplex).not.toContain("atrim");
    expect(graph.filterComplex).toContain("concat=n=2:v=1:a=0");
    expect(graph.audioLabel).toBeNull();
  });

  test("throws for an empty timeline", () => {
    expect(() =>
      buildFilterGraph(
        job({ timeline: { id: "t", sourceAssetId: "a", clips: [], totalDurationSec: 0 } }),
      ),
    ).toThrow(/zero clips/);
  });

  test("appends a subtitles filter when burnSubtitlesPath is set", () => {
    const graph = buildFilterGraph(job(), { burnSubtitlesPath: "/tmp/captions.srt" });
    expect(graph.filterComplex).toContain("subtitles=");
    expect(graph.videoLabel).toBe("[vfinal]");
  });

  test("scales and pads to the preset's target resolution", () => {
    const graph = buildFilterGraph(job());
    expect(graph.filterComplex).toContain("scale=1080:1920");
    expect(graph.filterComplex).toContain("pad=1080:1920");
  });
});

describe("escapeSubtitlesPath", () => {
  test("escapes colons and quotes for the ffmpeg subtitles filter", () => {
    expect(escapeSubtitlesPath("/tmp/it's:mine.srt")).toBe("/tmp/it\\'s\\:mine.srt");
  });
});

describe("buildFfmpegArgs", () => {
  test("maps video+audio and sets output path last", () => {
    const args = buildFfmpegArgs(job());
    expect(args[0]).toBe("-y");
    expect(args).toContain("-filter_complex");
    expect(args).toContain("[vscaled]");
    expect(args).toContain("[aout]");
    expect(args[args.length - 1]).toBe("/tmp/out.mp4");
    // -an should NOT be present when audio exists
    expect(args.includes("-an")).toBe(false);
  });

  test("adds -an when the source has no audio", () => {
    const args = buildFfmpegArgs(job({ asset: asset({ hasAudio: false }) }));
    expect(args.includes("-an")).toBe(true);
    expect(args.includes("-c:a")).toBe(false);
  });
});

describe("renderTimeline", () => {
  test("invokes ffmpeg via the injected exec with built args, no captions", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const fakeExec = async (command: string, args: string[]) => {
      calls.push({ command, args });
      return { stdout: "", stderr: "" };
    };

    const outputPath = await renderTimeline(job({ captions: [] }), {
      exec: fakeExec,
      burnCaptions: true,
    });

    expect(outputPath).toBe("/tmp/out.mp4");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("ffmpeg");
    expect(calls[0]?.args).not.toContain("subtitles");
  });

  test("writes an SRT file and burns captions when captions are present", async () => {
    let capturedArgs: string[] = [];
    const fakeExec = async (_command: string, args: string[]) => {
      capturedArgs = args;
      return { stdout: "", stderr: "" };
    };

    await renderTimeline(job({ captions: [{ index: 1, start: 0, end: 1, text: "hi" }] }), {
      exec: fakeExec,
    });

    const filterArg = capturedArgs[capturedArgs.indexOf("-filter_complex") + 1];
    expect(filterArg).toContain("subtitles=");
  });

  test("burns captions via an .ass file with colorIndex when captionFormat is 'ass'", async () => {
    let capturedArgs: string[] = [];
    const fakeExec = async (_command: string, args: string[]) => {
      capturedArgs = args;
      return { stdout: "", stderr: "" };
    };

    await renderTimeline(
      job({ captions: [{ index: 1, start: 0, end: 1, text: "hi", colorIndex: 1 }] }),
      { exec: fakeExec, captionFormat: "ass", assColors: ["#39FF14", "#FFFFFF"] },
    );

    const filterArg = capturedArgs[capturedArgs.indexOf("-filter_complex") + 1];
    expect(filterArg).toContain("subtitles=");
    expect(filterArg).toContain(".ass");
  });

  test("wraps exec failures in RenderError", async () => {
    const failingExec = async () => {
      throw new Error("ffmpeg exploded");
    };
    await expect(renderTimeline(job(), { exec: failingExec })).rejects.toThrow(
      /ffmpeg render failed/,
    );
  });
});
