import { describe, expect, it } from "vitest";
import { courseInputSchema, courseUpdateSchema } from "@/lib/course-input";

describe("course input validation", () => {
  it("accepts a persisted term and academic year", () => {
    expect(courseInputSchema.parse({ code: "CS101", nameTh: "Programming", credits: 3, grade: "A", term: "1", year: 2568 })).toMatchObject({ term: "1", year: 2568 });
  });
  it("rejects invalid academic years and empty updates", () => {
    expect(courseInputSchema.safeParse({ code: "CS101", credits: 3, year: 1800 }).success).toBe(false);
    expect(courseUpdateSchema.safeParse({}).success).toBe(false);
  });
});
