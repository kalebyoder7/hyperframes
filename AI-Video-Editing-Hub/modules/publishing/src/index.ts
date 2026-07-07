export { validateAgainstPreset } from "./presets.js";
export type { PublishValidationIssue } from "./presets.js";

export interface PublishMetadata {
  title: string;
  description?: string;
  tags?: string[];
}

export interface PublishResult {
  platform: string;
  publishedUrl?: string;
  status: "published" | "scheduled" | "failed";
}

// Contract for a platform upload integration (TikTok/YouTube/Instagram
// APIs). No implementation ships in this session — real OAuth + upload flows
// per platform are substantial, credential-bearing integrations out of scope
// for one pass. Implementing this interface is the extension point.
export interface PublishTarget {
  readonly platform: string;
  upload(filePath: string, metadata: PublishMetadata): Promise<PublishResult>;
}
