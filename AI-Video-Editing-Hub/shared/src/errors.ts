export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class IngestError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "video-ingest", cause);
  }
}

export class TranscriptionError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "transcription", cause);
  }
}

export class HighlightDetectionError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "clip-selection", cause);
  }
}

export class RenderError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "rendering", cause);
  }
}

export class ConfigError extends PipelineError {
  constructor(message: string, cause?: unknown) {
    super(message, "config", cause);
  }
}
