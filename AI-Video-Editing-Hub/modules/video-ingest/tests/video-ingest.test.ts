import { describe, expect, test } from "bun:test";
import {
  parseFfprobeOutput,
  parseFrameRate,
  selectVideoStream,
  toVideoAsset,
} from "../src/index.js";
import { IngestError } from "../../../shared/src/errors.js";

const FIXTURE_FFPROBE_JSON = JSON.stringify({
  streams: [
    {
      codec_type: "video",
      codec_name: "h264",
      width: 1920,
      height: 1080,
      avg_frame_rate: "30000/1001",
    },
    { codec_type: "audio", codec_name: "aac" },
  ],
  format: { duration: "125.4", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
});

describe("parseFfprobeOutput", () => {
  test("parses valid ffprobe JSON", () => {
    const result = parseFfprobeOutput(FIXTURE_FFPROBE_JSON);
    expect(result.streams).toHaveLength(2);
    expect(result.format.duration).toBe("125.4");
  });

  test("throws IngestError on invalid JSON", () => {
    expect(() => parseFfprobeOutput("not json")).toThrow(IngestError);
  });

  test("throws IngestError when streams/format missing", () => {
    expect(() => parseFfprobeOutput(JSON.stringify({}))).toThrow(IngestError);
  });
});

describe("selectVideoStream", () => {
  test("finds the video stream among mixed streams", () => {
    const probe = parseFfprobeOutput(FIXTURE_FFPROBE_JSON);
    const stream = selectVideoStream(probe.streams);
    expect(stream.codec_name).toBe("h264");
  });

  test("throws when no video stream present", () => {
    expect(() => selectVideoStream([{ codec_type: "audio" }])).toThrow(IngestError);
  });
});

describe("parseFrameRate", () => {
  test("parses fractional frame rate", () => {
    expect(parseFrameRate("30000/1001")).toBeCloseTo(29.97, 2);
  });

  test("parses whole frame rate", () => {
    expect(parseFrameRate("25/1")).toBe(25);
  });

  test("returns 0 for missing/invalid input", () => {
    expect(parseFrameRate(undefined)).toBe(0);
    expect(parseFrameRate("0/0")).toBe(0);
  });
});

describe("toVideoAsset", () => {
  test("builds a normalized VideoAsset from ffprobe output", () => {
    const probe = parseFfprobeOutput(FIXTURE_FFPROBE_JSON);
    const asset = toVideoAsset("test-id", "/tmp/source.mp4", probe);
    expect(asset).toMatchObject({
      id: "test-id",
      path: "/tmp/source.mp4",
      durationSec: 125.4,
      width: 1920,
      height: 1080,
      hasAudio: true,
      codec: "h264",
    });
    expect(asset.fps).toBeCloseTo(29.97, 2);
  });
});
