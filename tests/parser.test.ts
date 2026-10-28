import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/parser";
import { confirmedCourseSchema, extractionSchema, normalizedCourseCode } from "@/lib/extraction";

describe("transcript parser", () => {
  it("extracts normalized course data from a transcript row", () => {
    expect(parseTranscript("CS 101 Introduction to Programming 3 A")).toEqual([{
      code: "CS101", name: "Introduction to Programming", credits: 3, grade: "A",
      confidence: { code: .94, name: .65, credits: .6, grade: .8 },
    }]);
  });

  it("keeps incomplete OCR rows for review", () => {
    expect(parseTranscript("MATH-201 Calculus II")[0]).toMatchObject({ code: "MATH201", name: "Calculus II", credits: undefined });
  });
});

describe("extraction API validation", () => {
  it("accepts incomplete OCR data but rejects it for confirmation", () => {
    const row = { code: "CS 101", name: "Programming", confidence: { code: .9 } };
    expect(extractionSchema.safeParse({ courses: [row] }).success).toBe(true);
    expect(confirmedCourseSchema.safeParse(row).success).toBe(false);
  });

  it("requires valid fields and normalizes code before duplicate checks", () => {
    expect(confirmedCourseSchema.safeParse({ code: "CS101", name: "Programming", credits: 3, grade: "A" }).success).toBe(true);
    expect(confirmedCourseSchema.safeParse({ code: "CS101", name: "Programming", credits: 0 }).success).toBe(false);
    expect(normalizedCourseCode("cs-101")).toBe("CS101");
  });
});
