import { describe, expect, it } from "vitest";
import { dashboardSummary } from "@/lib/dashboard-summary";
import type { Course, Requirement } from "@/lib/types";

const courses: Course[] = [
  { id: "old", code: "CS101", nameTh: "Programming", credits: 3, grade: "A", term: "1", year: 2567 },
  { id: "pass", code: "GE101", nameTh: "Thai", credits: 2, grade: "P", term: "2", year: 2567 },
  { id: "satisfactory", code: "GE102", nameTh: "English", credits: 1, grade: "S", term: "2", year: 2567 },
  { id: "withdrawn", code: "MA101", nameTh: "Math", credits: 3, grade: "W", term: "2", year: 2567 },
  { id: "incomplete", code: "CO101", nameTh: "Co-op", credits: 1, grade: "I", term: "2", year: 2567 },
  { id: "not-reported", code: "IN101", nameTh: "Internship", credits: 1, grade: "N", term: "2", year: 2567 },
  { id: "ungraded", code: "RE101", nameTh: "Research", credits: 1, term: "2", year: 2567 },
];

const requirements: Requirement[] = [
  { id: "total", category: "หน่วยกิต", type: "total_credit", minimumCredits: 120 },
];

describe("dashboard summary", () => {
  it("excludes P/S/W/I/N and missing grades from GPA while retaining P/S passed credits", () => {
    const result = dashboardSummary(courses, [], []);
    expect(result.state).toBe("grades_only");
    expect(result.overall).toEqual({ gpa: 4, passedCredits: 6, gradedCredits: 3 });
    expect(result.latestTerm?.label).toBe("ปีการศึกษา 2567 · เทอม 2");
    expect(result.latestTerm?.summary).toEqual({ gpa: 0, passedCredits: 3, gradedCredits: 0 });
  });

  it("hides graduation progress until a confirmed course match exists", () => {
    const waiting = dashboardSummary(courses, requirements, []);
    expect(waiting.state).toBe("ready_without_matches");
    expect(waiting.progress).toBeNull();

    const ready = dashboardSummary(courses, requirements, [{ course_id: "old", degree_requirement_id: "total", status: "confirmed" }]);
    expect(ready.state).toBe("ready");
    expect(ready.progress).toEqual({ passedCredits: 3, totalCredits: 120, percentage: 3 });
  });

  it("reports an empty transcript state", () => {
    expect(dashboardSummary([], requirements, []).state).toBe("no_transcript");
  });
});
