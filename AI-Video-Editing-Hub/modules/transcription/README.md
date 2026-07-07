# transcription

Status: **Real / functional**, provider pattern with two implementations.

## Providers

- `OpenAIWhisperProvider` — calls OpenAI's hosted `/v1/audio/transcriptions`
  endpoint via native `fetch` (no SDK dependency). Requires `OPENAI_API_KEY`
  and network access.
- `LocalWhisperProvider` — shells out to a locally installed
  [whisper.cpp](https://github.com/ggml-org/whisper.cpp) binary for
  offline/no-API-key transcription. Requires `WHISPER_CPP_BIN` (or a
  `whisper-cli` on `PATH`) and `WHISPER_CPP_MODEL` pointing at a downloaded
  ggml model — neither binary nor model is bundled with this repo.

Both implement the same `TranscriptionProvider` interface, so swapping one
for the other is a one-line change at the call site (`scripts/pipeline.ts`).

## API

```ts
import { OpenAIWhisperProvider, transcribe } from "./src/index.js";

const provider = new OpenAIWhisperProvider();
const transcript = await transcribe(provider, "/path/to/audio.wav", asset.id);
```

## Design notes

- `mapToTranscript` / `mapWhisperCppOutput` are pure mapping functions split
  out from the network/process call so response-shape tests don't need a
  live API key or installed binary.
- `fetchFn` / `exec` are injectable on both providers for the same reason.

## Not yet implemented

- Streaming/incremental transcription for long-running live capture.
- Automatic language detection override / multi-language mixed audio.
- Retry/backoff policy for transient OpenAI API failures (currently a single
  attempt; caller is responsible for retrying).
