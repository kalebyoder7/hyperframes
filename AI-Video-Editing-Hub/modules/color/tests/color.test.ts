import { describe, expect, test } from "bun:test";
import { buildColorArgs, buildEqFilter } from "../src/presets.js";
import { applyColorPreset, ColorProcessingError } from "../src/index.js";

describe("buildEqFilter", () => {
  test("builds an eq filter string for a known preset", () => {
    expect(buildEqFilter("punchy")).toContain("contrast=1.2");
  });

  test("throws for an unknown preset", () => {
    expect(() => buildEqFilter("neon" as never)).toThrow(/unknown color preset/);
  });
});

describe("buildColorArgs", () => {
  test("flat preset skips the eq filter but still re-encodes", () => {
    const args = buildColorArgs("/tmp/in.mp4", "/tmp/out.mp4", "flat");
    expect(args).not.toContain("-vf");
    expect(args[args.length - 1]).toBe("/tmp/out.mp4");
  });

  test("non-flat presets include the eq filter", () => {
    const args = buildColorArgs("/tmp/in.mp4", "/tmp/out.mp4", "warm");
    expect(args).toContain("-vf");
    const filterIndex = args.indexOf("-vf") + 1;
    expect(args[filterIndex]).toContain("eq=");
  });
});

describe("applyColorPreset", () => {
  test("invokes ffmpeg via the injected exec", async () => {
    const calls: string[][] = [];
    const fakeExec = async (_cmd: string, args: string[]) => {
      calls.push(args);
      return { stdout: "", stderr: "" };
    };
    const result = await applyColorPreset("/tmp/in.mp4", "/tmp/out.mp4", "cool", {
      exec: fakeExec,
    });
    expect(result).toBe("/tmp/out.mp4");
    expect(calls).toHaveLength(1);
  });

  test("wraps exec failures in ColorProcessingError", async () => {
    const failingExec = async () => {
      throw new Error("boom");
    };
    await expect(
      applyColorPreset("/tmp/in.mp4", "/tmp/out.mp4", "warm", { exec: failingExec }),
    ).rejects.toThrow(ColorProcessingError);
  });
});
