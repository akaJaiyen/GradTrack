import { describe, expect, it } from "vitest";
import { estimateDocumentProgress, formatElapsedTime, summarizeAcademicDocumentProcessing } from "@/lib/document-processing";

describe("academic document processing summary", () => {
  it("estimates progress from elapsed time without claiming the background job is complete", () => {
    expect(estimateDocumentProgress(0)).toBe(0);
    expect(estimateDocumentProgress(150_000)).toBe(47);
    expect(estimateDocumentProgress(300_000)).toBe(95);
    expect(estimateDocumentProgress(600_000)).toBe(95);
    expect(estimateDocumentProgress(-1)).toBe(0);
  });

  it("formats elapsed processing time", () => {
    expect(formatElapsedTime(9_000)).toBe("9 วินาที");
    expect(formatElapsedTime(125_000)).toBe("2 นาที 5 วินาที");
  });

  it("waits for the second required document before allowing analysis", () => {
    const result = summarizeAcademicDocumentProcessing([{ type: "study_plan", status: "uploaded" }]);
    expect(result).toMatchObject({ documentCount: 1, documentList: "Study Plan", state: "awaiting_documents", canStart: false });
  });

  it("lists both document types when the combined run is active", () => {
    const result = summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "ready" },
      { type: "transcript", status: "extracting" },
    ]);
    expect(result).toMatchObject({ documentCount: 2, documentList: "Study Plan และ Transcript", state: "processing" });
  });

  it("offers one explicit start action only after both files are uploaded", () => {
    const result = summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "uploaded" },
      { type: "transcript", status: "uploaded" },
    ]);
    expect(result).toMatchObject({ state: "ready_to_process", canStart: true, canRetry: false });
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
    const result = summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "ready" },
      { type: "transcript", status: "rate_limited" },
    ]);
    expect(result).toMatchObject({ state: "retryable", canRetry: true });
    expect(result.title).toContain("หยุดชั่วคราว");
  });

  it("does not expose a retry before documents exist", () => {
    expect(summarizeAcademicDocumentProcessing([])).toMatchObject({ state: "empty", canStart: false, canRetry: false });
  });

  it("allows an explicit reprocess after a completed run", () => {
    expect(summarizeAcademicDocumentProcessing([
      { type: "study_plan", status: "ready" },
      { type: "transcript", status: "ready" },
    ])).toMatchObject({ state: "complete", canReprocess: true });
  });
});
