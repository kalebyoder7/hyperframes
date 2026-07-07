# video-ingest

Status: **Real / functional.**

Validates and probes a local video file via `ffprobe` (bundled with ffmpeg)
and normalizes the result into a `VideoAsset` (see `shared/src/types.ts`).

## Requirements

- `ffmpeg`/`ffprobe` on `PATH`.

## API

```ts
import { ingestVideo } from "./src/index.js";

const asset = await ingestVideo("/path/to/source.mp4");
// { id, path, durationSec, width, height, fps, hasAudio, codec, createdAt }
```

## Design notes

- `parseFfprobeOutput` / `toVideoAsset` are pure functions split out from
  `ingestVideo` specifically so tests can feed fixture ffprobe JSON without
  needing the binary installed in CI/sandboxes.
- `exec` is injectable (`IngestOptions.exec`) for the same reason.

## Not yet implemented

- Remote/URL ingestion (S3, signed URLs, YouTube-DL style download).
- Multi-file batch ingest.
- Checksum/dedup against previously ingested assets.
