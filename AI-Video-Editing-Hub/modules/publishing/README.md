# publishing

Status: **`validateAgainstPreset` is real / functional. Platform upload is
an unimplemented interface (`PublishTarget`), honestly labeled.**

## `validateAgainstPreset` — Status: **Real**

Checks a candidate export's duration/resolution against a platform's
`ExportPreset` (from `rendering/src/presets.ts`) and returns human-readable
issues. Useful standalone even with zero upload integration — catches
"this won't be accepted by TikTok" before attempting anything.

```ts
import { validateAgainstPreset } from "./src/index.js";

const issues = validateAgainstPreset("tiktok", 65, 1080, 1920);
// [{ field: "duration", message: "65.0s exceeds tiktok's max of 180s" }] — none here, this passes
```

## `PublishTarget` — Status: **Interface only, not implemented**

Real per-platform publishing needs OAuth + each platform's upload API
(TikTok Content Posting API, YouTube Data API, Instagram Graph API, ...) —
credential-bearing integrations substantial enough to be their own scoped
task, not attempted here. The interface is the extension point:

```ts
interface PublishTarget {
  readonly platform: string;
  upload(filePath: string, metadata: PublishMetadata): Promise<PublishResult>;
}
```

## Not yet implemented

- Any concrete `PublishTarget` (TikTok/YouTube/Instagram/LinkedIn).
- Scheduling / queuing uploads.
- Cross-posting the same export to multiple platforms in one call.
