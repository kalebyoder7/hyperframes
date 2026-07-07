import { describe, expect, test } from "bun:test";
import { generateLowerThirdClip } from "../src/lowerThird.js";

describe("generateLowerThirdClip", () => {
  test("embeds title, subtitle, and timing attributes", () => {
    const html = generateLowerThirdClip({
      title: "Jane Doe",
      subtitle: "Product Lead",
      startSec: 4,
      durationSec: 3.5,
    });
    expect(html).toContain('data-start="4"');
    expect(html).toContain('data-duration="3.5"');
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Product Lead");
    expect(html).toContain('class="clip lower-third"');
  });

  test("omits the subtitle element when not provided", () => {
    const html = generateLowerThirdClip({ title: "Solo Title", startSec: 0, durationSec: 2 });
    expect(html).not.toContain('class="subtitle"');
  });

  test("escapes HTML-significant characters in title/subtitle", () => {
    const html = generateLowerThirdClip({
      title: "<script>alert(1)</script>",
      startSec: 0,
      durationSec: 2,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
