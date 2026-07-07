import type { ExportPreset, Platform } from "../../../shared/src/types.js";

export const EXPORT_PRESETS: Record<Platform, ExportPreset> = {
  tiktok: {
    platform: "tiktok",
    width: 1080,
    height: 1920,
    fps: 30,
    maxDurationSec: 180,
    format: "mp4",
  },
  "youtube-shorts": {
    platform: "youtube-shorts",
    width: 1080,
    height: 1920,
    fps: 30,
    maxDurationSec: 60,
    format: "mp4",
  },
  "instagram-reels": {
    platform: "instagram-reels",
    width: 1080,
    height: 1920,
    fps: 30,
    maxDurationSec: 90,
    format: "mp4",
  },
  "youtube-landscape": {
    platform: "youtube-landscape",
    width: 1920,
    height: 1080,
    fps: 30,
    maxDurationSec: 43200,
    format: "mp4",
  },
  linkedin: {
    platform: "linkedin",
    width: 1080,
    height: 1080,
    fps: 30,
    maxDurationSec: 600,
    format: "mp4",
  },
};

export function getPreset(platform: Platform): ExportPreset {
  const preset = EXPORT_PRESETS[platform];
  if (!preset) throw new Error(`no export preset registered for platform: ${platform}`);
  return preset;
}
