import { describe, expect, it } from "vitest";
import { groupCoursesByTerm } from "@/lib/course-term-summary";
import type { Course } from "@/lib/types";

const course = (id: string, term: string | undefined, year: number | undefined, credits: number, grade?: Course["grade"]): Course => ({ id, code: id, nameTh: id, term, year, credits, grade });

describe("course term summaries", () => {
  it("orders terms and calculates passed credits, term GPA, and cumulative GPA", () => {
    const terms = groupCoursesByTerm([
      course("later", "2", 2567, 3, "B"),
      course("earlier", "1", 2567, 3, "A"),
      course("pass", "1", 2567, 2, "P"),
      course("withdrawn", "1", 2567, 1, "W"),
    ]);
    expect(terms.map((term) => term.label)).toEqual(["ปีการศึกษา 2567 · เทอม 1", "ปีการศึกษา 2567 · เทอม 2"]);
    expect(terms[0].summary).toEqual({ passedCredits: 5, gradedCredits: 3, gpa: 4 });
    expect(terms[1].summary).toEqual({ passedCredits: 3, gradedCredits: 3, gpa: 3 });
    expect(terms[1].cumulative).toEqual({ passedCredits: 8, gradedCredits: 6, gpa: 3.5 });
  });

  it("keeps unassigned courses together and reports no GPA when grades are non-numeric", () => {
    const [term] = groupCoursesByTerm([course("incomplete", undefined, undefined, 3, "I"), course("not-pass", undefined, undefined, 2, "N")]);
    expect(term.label).toBe("ไม่ระบุเทอม");
    expect(term.summary).toEqual({ passedCredits: 0, gradedCredits: 0, gpa: 0 });
  });
});
