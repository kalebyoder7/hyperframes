import { readFileSync } from "node:fs";
import { ConfigError } from "./errors.js";
import type { PipelineConfig } from "./types.js";

const DEFAULTS: PipelineConfig = {
  targetDurationSec: 60,
  minHighlightScore: 0.35,
  platform: "youtube-shorts",
  burnCaptions: true,
  normalizeAudio: true,
};

export function loadConfig(
  configPath?: string,
  overrides: Partial<PipelineConfig> = {},
): PipelineConfig {
  let fileConfig: Partial<PipelineConfig> = {};
  if (configPath) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch (cause) {
      throw new ConfigError(`Failed to load config from ${configPath}`, cause);
    }
  }
  const merged: PipelineConfig = { ...DEFAULTS, ...fileConfig, ...overrides };
  validateConfig(merged);
  return merged;
}

function validateConfig(config: PipelineConfig): void {
  if (config.targetDurationSec <= 0) {
    throw new ConfigError(`targetDurationSec must be positive, got ${config.targetDurationSec}`);
  }
  if (config.minHighlightScore < 0 || config.minHighlightScore > 1) {
    throw new ConfigError(
      `minHighlightScore must be within [0, 1], got ${config.minHighlightScore}`,
    );
  }
}
