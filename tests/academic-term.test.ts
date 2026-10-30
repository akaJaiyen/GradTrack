import { describe, expect, it } from "vitest";
import { normalizeAcademicTerm, normalizeAcademicTermAndYear } from "@/lib/academic-term";
import { normalizeAcademicPayload } from "@/lib/academic-payload";

describe("academic term normalization", () => {
  it("normalizes Thai and English aliases and reads an embedded year", () => {
    expect(normalizeAcademicTerm("First Semester")).toBe("1");
    expect(normalizeAcademicTerm("เทอม 2")).toBe("2");
    expect(normalizeAcademicTerm("Summer Session")).toBe("summer");
    expect(normalizeAcademicTermAndYear("First Semester 2025", null)).toEqual({ term: "1", academicYear: 2025 });
  });

  it("leaves unsupported terms unspecified instead of guessing", () => {
    expect(normalizeAcademicTerm("Fourth Semester")).toBeNull();
    const result = normalizeAcademicPayload({ completedCourses: [{ code: "CS101", name: "Programming", credits: 3, term: "Fourth Semester" }] }, "00000000-0000-4000-8000-000000000000");
    expect(result.success && result.data.completedCourses[0]).toMatchObject({ term: null, academicYear: null });
  });
});
