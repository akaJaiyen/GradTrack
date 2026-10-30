import { describe, expect, it } from "vitest";
import { textForGemini } from "@/lib/local-extraction";

describe("textForGemini", () => {
  it("uses sufficiently confident local text", () => {
    expect(textForGemini({ text: "a".repeat(160), confidence: 0.5 })).toHaveLength(160);
  });

  it("falls back to the original document for short or low-confidence text", () => {
    expect(textForGemini({ text: "a".repeat(159), confidence: 0.9 })).toBeNull();
    expect(textForGemini({ text: "a".repeat(160), confidence: 0.49 })).toBeNull();
  });
});
