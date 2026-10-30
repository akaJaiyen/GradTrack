import { describe, expect, it } from "vitest";
import { summarizeAcademicDocumentProcessing } from "@/lib/document-processing";

describe("academic document processing summary", () => {
  it("describes one uploaded document as a shared processing input", () => {
    const result = summarizeAcademicDocumentProcessing([{ type: "study_plan", status: "ready" }]);
    expect(result).toMatchObject({ documentCount: 1, documentList: "Study Plan", state: "complete", canRetry: false });
  });

  it("lists both document types when the combined run is active", () => {
    const result = summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "ready" },
      { type: "transcript", status: "extracting" },
    ]);
    expect(result).toMatchObject({ documentCount: 2, documentList: "Study Plan และ Transcript", state: "processing" });
  });

  it("offers one combined retry when any document fails", () => {
    const result = summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "failed" },
      { type: "transcript", status: "ready" },
    ]);
    expect(result).toMatchObject({ state: "retryable", canRetry: true });
    expect(result.description).toContain("Study Plan และ Transcript");
  });

  it("explains a rate limit at the combined-processing level", () => {
    const result = summarizeAcademicDocumentProcessing([{ type: "transcript", status: "rate_limited" }]);
    expect(result).toMatchObject({ state: "retryable", canRetry: true });
    expect(result.title).toContain("หยุดชั่วคราว");
  });

  it("does not expose a retry before documents exist", () => {
    expect(summarizeAcademicDocumentProcessing([])).toMatchObject({ state: "empty", canRetry: false });
  });
});
