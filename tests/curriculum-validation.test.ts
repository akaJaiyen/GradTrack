import { describe, expect, it } from "vitest";
import { validateCurriculumDraft } from "@/lib/curriculum-validation";

describe("curriculum draft validation", () => {
  it("rejects an unbalanced required bucket", () => {
    expect(validateCurriculumDraft([
      { id: "total", name: "รวม", minimumCredits: 3, kind: "total", evidence: "test" },
      { id: "required", name: "บังคับ", minimumCredits: 3, kind: "required_bucket", evidence: "test" },
    ], [{ code: "CS101", nameEn: "Test", credits: 2, confidence: 1 }], { CS101: "required" })).toContain("ต้องรวม 3");
  });
});
