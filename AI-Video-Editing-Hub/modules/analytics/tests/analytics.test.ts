import { describe, expect, test, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlAnalyticsSink } from "../src/index.js";

let workDir: string | undefined;

afterEach(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
  workDir = undefined;
});

describe("JsonlAnalyticsSink", () => {
  test("appends newline-delimited JSON events", async () => {
    workDir = await mkdtemp(join(tmpdir(), "analytics-test-"));
    const filePath = join(workDir, "nested", "events.jsonl");
    const sink = new JsonlAnalyticsSink(filePath);

    await sink.track("stage.started", { stage: "transcription" });
    await sink.track("stage.completed", { stage: "transcription", durationMs: 100 });

    const raw = await readFile(filePath, "utf-8");
    const lines = raw
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      name: "stage.started",
      properties: { stage: "transcription" },
    });
    expect(lines[1]).toMatchObject({ name: "stage.completed", properties: { durationMs: 100 } });
    expect(typeof lines[0].timestamp).toBe("string");
  });

  test("creates parent directories that don't yet exist", async () => {
    workDir = await mkdtemp(join(tmpdir(), "analytics-test-"));
    const filePath = join(workDir, "a", "b", "c", "events.jsonl");
    const sink = new JsonlAnalyticsSink(filePath);
    await sink.track("test.event");
    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain("test.event");
  });
});
