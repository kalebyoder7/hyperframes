import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { IngestError } from "../../../shared/src/errors.js";
import { createLogger } from "../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../shared/src/exec.js";
import type { VideoAsset } from "../../../shared/src/types.js";
import type { FfprobeOutput, FfprobeStream } from "./types.js";

const logger = createLogger("video-ingest");

export interface IngestOptions {
  exec?: ExecFn;
}

// Parses raw `ffprobe -show_format -show_streams -of json` output into an
// FfprobeOutput. Split out from ingestVideo so it's testable with fixture
// JSON, without needing ffprobe installed.
export function parseFfprobeOutput(raw: string): FfprobeOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new IngestError("ffprobe output was not valid JSON", cause);
  }
  const output = parsed as Partial<FfprobeOutput>;
  if (!output.streams || !output.format) {
    throw new IngestError("ffprobe output missing streams/format");
  }
  return output as FfprobeOutput;
}

export function selectVideoStream(streams: FfprobeStream[]): FfprobeStream {
  const videoStream = streams.find((s) => s.codec_type === "video");
  if (!videoStream) {
    throw new IngestError("no video stream found in source file");
  }
  return videoStream;
}

export function parseFrameRate(rateExpr: string | undefined): number {
  if (!rateExpr) return 0;
  const [num, den] = rateExpr.split("/").map(Number);
  if (!num || !den) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

export function toVideoAsset(id: string, path: string, probe: FfprobeOutput): VideoAsset {
  const videoStream = selectVideoStream(probe.streams);
  const hasAudio = probe.streams.some((s) => s.codec_type === "audio");
  return {
    id,
    path,
    durationSec: Number(probe.format.duration ?? 0),
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps: parseFrameRate(videoStream.avg_frame_rate ?? videoStream.r_frame_rate),
    hasAudio,
    codec: videoStream.codec_name ?? "unknown",
    createdAt: new Date().toISOString(),
  };
}

// Ingests a local video file: validates it exists, probes it with ffprobe,
// and returns a normalized VideoAsset. Requires ffprobe (part of the ffmpeg
// suite) to be installed and on PATH.
export async function ingestVideo(path: string, options: IngestOptions = {}): Promise<VideoAsset> {
  const exec = options.exec ?? realExec;
  if (!existsSync(path)) {
    throw new IngestError(`source file does not exist: ${path}`);
  }

  logger.info("probing source file", { path });
  let stdout: string;
  try {
    const result = await exec("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      path,
    ]);
    stdout = result.stdout;
  } catch (cause) {
    throw new IngestError(
      `ffprobe failed for ${path} — is ffmpeg/ffprobe installed and on PATH?`,
      cause,
    );
  }

  const probe = parseFfprobeOutput(stdout);
  const asset = toVideoAsset(randomUUID(), path, probe);
  logger.info("ingested video asset", { assetId: asset.id, durationSec: asset.durationSec });
  return asset;
}
