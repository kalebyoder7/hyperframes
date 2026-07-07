# analytics

Status: **Real / functional** for local pipeline event tracking. Platform
analytics (view counts, engagement pulled back from TikTok/YouTube/etc.) is
**not implemented**.

`JsonlAnalyticsSink` appends newline-delimited JSON events to a log file —
used by `scripts/pipeline.ts` to record stage start/success/failure and
timings under `logs/`.

## API

```ts
import { JsonlAnalyticsSink } from "./src/index.js";

const analytics = new JsonlAnalyticsSink("../logs/pipeline-events.jsonl");
await analytics.track("stage.completed", { stage: "transcription", durationMs: 4210 });
```

## Not yet implemented

- Pulling post-publish engagement metrics back from platform APIs (depends
  on `publishing/`'s `PublishTarget` integrations existing first).
- Aggregation/rollup queries over the JSONL log (currently append-only;
  reading/summarizing is left to the caller or an external tool).
- A hosted analytics backend (PostHog/Amplitude/etc.) sink — `AnalyticsSink`
  is the interface a second implementation would target.
