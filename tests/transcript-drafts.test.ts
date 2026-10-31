import { describe, expect, it } from "vitest";
import { academicProfileExtractionSchema } from "@/lib/extraction";
import { aiTranscriptDrafts } from "@/lib/transcript-drafts";

const sourceDocumentId = "33333333-3333-4333-8333-333333333333";

describe("AI transcript drafts", () => {
  it("keeps extracted courses for user review when OCR evidence is incomplete", () => {
    const extraction = academicProfileExtractionSchema.parse({
      profile: {},
      curriculum: {},
      catalogCourses: [],
      completedCourses: [{ code: "01204113", name: "Computer Programming", credits: 3, grade: "A", term: "1", academicYear: 2025 }],
      unresolvedCourses: [],
      evidence: [{ path: "completedCourses.0", sourceDocumentId, page: null, text: "01204113 Computer Programming A 3", confidence: 0.8 }],
      warnings: [],
      sources: [{ sourceDocumentId, detectedKind: "transcript" }],
    });

    expect(aiTranscriptDrafts(extraction, 1)).toMatchObject([
      { code: "01204113", name: "Computer Programming", status: "needs_review", parser: "ai" },
    ]);
  });

  it("marks a transcript draft ready when its course and term evidence are complete", () => {
    const extraction = academicProfileExtractionSchema.parse({
      profile: {},
      curriculum: {},
      catalogCourses: [],
      completedCourses: [{ code: "01204113", name: "Computer Programming", credits: 3, grade: "A", term: "1", academicYear: 2025 }],
      unresolvedCourses: [],
      evidence: [{ path: "completedCourses.0", sourceDocumentId, page: 1, text: "First Semester 2025 01204113 Computer Programming A 3", confidence: 0.9 }],
      warnings: [],
      sources: [{ sourceDocumentId, detectedKind: "transcript" }],
    });

    expect(aiTranscriptDrafts(extraction, 1)).toMatchObject([
      { status: "ready", evidence: { page: 1, termHeader: "First Semester 2025" } },
    ]);
  });
});
