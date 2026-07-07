import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface AnalyticsEvent {
  name: string;
  timestamp: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsSink {
  track(name: string, properties?: Record<string, unknown>): Promise<void>;
}

// Real, functional local sink: appends newline-delimited JSON events to a
// log file — enough to track pipeline stage timings/outcomes today, and a
// stable append point for a future platform-analytics puller (view counts,
// engagement) to write alongside. No dependency on any external analytics
// service.
export class JsonlAnalyticsSink implements AnalyticsSink {
  constructor(private readonly filePath: string) {}

  async track(name: string, properties?: Record<string, unknown>): Promise<void> {
    const event: AnalyticsEvent = { name, timestamp: new Date().toISOString(), properties };
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, JSON.stringify(event) + "\n", "utf-8");
  }
}
