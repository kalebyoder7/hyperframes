import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TranscriptionError } from "../../../../shared/src/errors.js";
import { createLogger } from "../../../../shared/src/logger.js";
import { realExec, type ExecFn } from "../../../../shared/src/exec.js";
import type { Transcript, TranscriptSegment } from "../../../../shared/src/types.js";
import type { TranscriptionProvider } from "../types.js";

const logger = createLogger("transcription:local-whisper");

interface WhisperCppJsonSegment {
  id: number;
  start: number; // seconds
  end: number;
  text: string;
}

interface WhisperCppJsonOutput {
  language: string;
  segments: WhisperCppJsonSegment[];
}

export interface LocalWhisperProviderOptions {
  binaryPath?: string; // path to a whisper.cpp `main`/`whisper-cli` build
  modelPath?: string; // path to a .bin ggml model
  exec?: ExecFn;
}

// Real implementation backed by a locally installed whisper.cpp binary,
// for offline/no-API-key transcription. Requires the caller to provide (or
// have on PATH) a whisper.cpp build and a downloaded ggml model — neither is
// bundled with this repo. Shells out to `<binary> -m <model> -f <wav> -oj`
// (whisper.cpp's JSON output mode) and parses the result file.
export class LocalWhisperProvider implements TranscriptionProvider {
  readonly name = "local-whisper-cpp";
  private readonly binaryPath: string;
  private readonly modelPath: string;
  private readonly exec: ExecFn;

  constructor(options: LocalWhisperProviderOptions = {}) {
    this.binaryPath = options.binaryPath ?? process.env["WHISPER_CPP_BIN"] ?? "whisper-cli";
    this.modelPath = options.modelPath ?? process.env["WHISPER_CPP_MODEL"] ?? "";
    this.exec = options.exec ?? realExec;
    if (!this.modelPath) {
      logger.warn("no WHISPER_CPP_MODEL configured — transcribe() will fail until one is provided");
    }
  }

  async transcribe(audioPath: string, sourceAssetId: string): Promise<Transcript> {
    if (!this.modelPath) {
      throw new TranscriptionError(
        "LocalWhisperProvider requires a ggml model path (WHISPER_CPP_MODEL env var or { modelPath }).",
      );
    }

    const workDir = await mkdtemp(join(tmpdir(), "ai-video-editing-hub-whisper-"));
    const outputPrefix = join(workDir, randomUUID());

    try {
      logger.info("running local whisper.cpp transcription", {
        audioPath,
        binary: this.binaryPath,
      });
      await this.exec(this.binaryPath, [
        "-m",
        this.modelPath,
        "-f",
        audioPath,
        "-oj", // output json
        "-of",
        outputPrefix,
      ]);

      const raw = await readFile(`${outputPrefix}.json`, "utf-8");
      const parsed = JSON.parse(raw) as WhisperCppJsonOutput;
      return mapWhisperCppOutput(parsed, sourceAssetId);
    } catch (cause) {
      if (cause instanceof TranscriptionError) throw cause;
      throw new TranscriptionError(
        `local whisper.cpp transcription failed — is ${this.binaryPath} on PATH and the model valid?`,
        cause,
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

export function mapWhisperCppOutput(
  output: WhisperCppJsonOutput,
  sourceAssetId: string,
): Transcript {
  const segments: TranscriptSegment[] = output.segments.map((s) => ({
    id: `seg-${s.id}`,
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));
  return { sourceAssetId, language: output.language ?? "unknown", segments };
}
