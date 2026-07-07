// Extracts a mono 16kHz PCM WAV audio track from a video file via ffmpeg —
// the format whisper.cpp expects. (OpenAI's hosted Whisper endpoint accepts
// video containers like mp4 directly, so this step is only needed for the
// LocalWhisperProvider path.)
export function buildExtractAudioArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    outputPath,
  ];
}
