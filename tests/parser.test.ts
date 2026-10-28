import { describe, expect, it } from "vitest";
import { parseTranscript } from "@/lib/parser";
import { confirmedCourseSchema, extractionSchema, normalizedCourseCode } from "@/lib/extraction";

describe("transcript parser", () => {
  it("extracts normalized course data from a transcript row", () => {
    expect(parseTranscript("CS 101 Introduction to Programming A 3")).toMatchObject([{
      code: "CS101", name: "Introduction to Programming", credits: 3, grade: "A",
    }]);
  });

  it("parses KU numeric codes from PDF text flattened into one line", () => {
    const courses = parseTranscript("First Semester 2023 01204113 Computer and Programming for Computer Engineers A 3 01355101 English for Everyday Life P 3* 01420113 Laboratory in Physics I B+ 1 sem. G.P.A. = 3.47");
    expect(courses).toMatchObject([
      { code: "01204113", name: "Computer and Programming for Computer Engineers", grade: "A", credits: 3 },
      { code: "01355101", name: "English for Everyday Life", grade: "P", credits: 3 },
      { code: "01420113", name: "Laboratory in Physics I", grade: "B+", credits: 1 },
    ]);
  });

  it("does not merge adjacent KU courses with plus grades", () => {
    const courses = parseTranscript("01417167 Engineering Mathematics I C+ 3 01420111 General Physics I C+ 3 01420113 Laboratory in Physics I B+ 1 01999021 Thai Language for Communication A 3");
    expect(courses.map(course => [course.code, course.name, course.grade, course.credits])).toEqual([
      ["01417167", "Engineering Mathematics I", "C+", 3],
      ["01420111", "General Physics I", "C+", 3],
      ["01420113", "Laboratory in Physics I", "B+", 1],
      ["01999021", "Thai Language for Communication", "A", 3],
    ]);
  });

  it("keeps an unreported KU grade as N", () => {
    expect(parseTranscript("01204490 Co-operative Education N 7 Nothing follows")).toMatchObject([{ code: "01204490", grade: "N", credits: 7 }]);
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
