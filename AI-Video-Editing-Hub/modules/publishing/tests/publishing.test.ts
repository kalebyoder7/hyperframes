import { describe, expect, test } from "bun:test";
import { validateAgainstPreset } from "../src/presets.js";

describe("validateAgainstPreset", () => {
  test("returns no issues for a compliant export", () => {
    const issues = validateAgainstPreset("youtube-shorts", 45, 1080, 1920);
    expect(issues).toEqual([]);
  });

  test("flags duration exceeding the platform max", () => {
    const issues = validateAgainstPreset("youtube-shorts", 90, 1080, 1920);
    expect(issues.some((i) => i.field === "duration")).toBe(true);
  });

  test("flags resolution mismatches", () => {
    const issues = validateAgainstPreset("tiktok", 30, 1920, 1080);
    expect(issues.some((i) => i.field === "resolution")).toBe(true);
  });

  test("can flag both duration and resolution simultaneously", () => {
    const issues = validateAgainstPreset("youtube-shorts", 999, 100, 100);
    expect(issues).toHaveLength(2);
  });
});
