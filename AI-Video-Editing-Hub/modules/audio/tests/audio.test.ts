import { describe, expect, test } from "bun:test";
import {
  buildFirstPassArgs,
  buildSecondPassArgs,
  parseLoudnormMeasurement,
  DEFAULT_LOUDNORM_TARGET,
} from "../src/loudnorm.js";
import { normalizeAudio, extractAudioTrack, AudioProcessingError } from "../src/index.js";
import { buildExtractAudioArgs } from "../src/extract.js";

const FIXTURE_STDERR = `
[Parsed_loudnorm_0 @ 0x1234]
{
	"input_i" : "-27.61",
	"input_tp" : "-4.03",
	"input_lra" : "5.30",
	"input_thresh" : "-38.15",
	"output_i" : "-16.01",
	"output_tp" : "-1.50",
	"output_lra" : "3.40",
	"output_thresh" : "-26.44",
	"normalization_type" : "dynamic",
	"target_offset" : "0.01"
}
`;

describe("buildFirstPassArgs", () => {
  test("builds a null-output measurement pass", () => {
    const args = buildFirstPassArgs("/tmp/in.mp4");
    expect(args).toContain("-i");
    expect(args).toContain("/tmp/in.mp4");
    expect(args.join(" ")).toContain("print_format=json");
    expect(args[args.length - 1]).toBe("-");
  });
});

describe("parseLoudnormMeasurement", () => {
  test("extracts the JSON block from ffmpeg's stderr output", () => {
    const measurement = parseLoudnormMeasurement(FIXTURE_STDERR);
    expect(measurement.input_i).toBe("-27.61");
    expect(measurement.target_offset).toBe("0.01");
  });

  test("throws when no JSON block is present", () => {
    expect(() => parseLoudnormMeasurement("no json here")).toThrow();
  });
});

describe("buildSecondPassArgs", () => {
  test("includes measured values and target output path", () => {
    const measurement = parseLoudnormMeasurement(FIXTURE_STDERR);
    const args = buildSecondPassArgs(
      "/tmp/in.mp4",
      "/tmp/out.mp4",
      measurement,
      DEFAULT_LOUDNORM_TARGET,
    );
    expect(args.join(" ")).toContain("measured_I=-27.61");
    expect(args[args.length - 1]).toBe("/tmp/out.mp4");
  });
});

describe("buildExtractAudioArgs", () => {
  test("extracts mono 16kHz PCM WAV", () => {
    const args = buildExtractAudioArgs("/tmp/in.mp4", "/tmp/out.wav");
    expect(args).toContain("-vn");
    expect(args).toContain("pcm_s16le");
    expect(args).toContain("16000");
    expect(args[args.length - 1]).toBe("/tmp/out.wav");
  });
});

describe("extractAudioTrack", () => {
  test("invokes ffmpeg via the injected exec", async () => {
    const calls: string[][] = [];
    const fakeExec = async (_cmd: string, args: string[]) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };
    const result = await extractAudioTrack("/tmp/in.mp4", "/tmp/out.wav", { exec: fakeExec });
    expect(result).toBe("/tmp/out.wav");
    expect(calls).toHaveLength(1);
  });
});

describe("normalizeAudio", () => {
  test("runs a two-pass normalization via the injected exec", async () => {
    const calls: string[][] = [];
    const fakeExec = async (_cmd: string, args: string[]) => {
      calls.push(args);
      if (args.includes("-f")) {
        return { stdout: "", stderr: FIXTURE_STDERR };
      }
      return { stdout: "", stderr: "" };
    };

    const result = await normalizeAudio("/tmp/in.mp4", "/tmp/out.mp4", { exec: fakeExec });
    expect(result).toBe("/tmp/out.mp4");
    expect(calls).toHaveLength(2);
  });

  test("wraps failures in AudioProcessingError", async () => {
    const failingExec = async () => {
      throw new Error("boom");
    };
    await expect(
      normalizeAudio("/tmp/in.mp4", "/tmp/out.mp4", { exec: failingExec }),
    ).rejects.toThrow(AudioProcessingError);
  });
});
