import { describe, expect, it } from "vitest";
import { graduationGapSummary } from "@/lib/graduation-gap-summary";
import type { Course, Requirement } from "@/lib/types";

const courses: Course[] = [
  { id: "failed", code: "CS101", nameTh: "Programming", credits: 3, grade: "F" },
  { id: "candidate", code: "TH100", nameTh: "Thai Communication", credits: 3, grade: "A" },
  { id: "elective", code: "EL100", nameTh: "Free elective", credits: 2, grade: "B" },
];

const requirements: Requirement[] = [
  { id: "failed-required", category: "แกน", type: "required_course", code: "CS101", name: "Programming", minimumCredits: 3 },
  { id: "missing-required", category: "แกน", type: "required_course", code: "CS102", name: "Data Structures", minimumCredits: 3 },
  { id: "name-required", category: "ทั่วไป", type: "required_course", name: "Thai Communication", minimumCredits: 3 },
  { id: "incomplete-elective", category: "เลือกเสรี", type: "elective_credit", minimumCredits: 6 },
  { id: "complete-elective", category: "ภาษา", type: "elective_credit", minimumCredits: 2 },
];

describe("graduation gap summary", () => {
  it("separates missing and not-passed required courses", () => {
    const result = graduationGapSummary(courses, requirements, []);

    expect(result.missingRequired.map((course) => course.requirementId)).toEqual(["missing-required"]);
    expect(result.notPassedRequired.map((course) => course.requirementId)).toEqual(["failed-required"]);
  });

  it("reports only elective categories whose confirmed credits are incomplete", () => {
    const result = graduationGapSummary(courses, requirements, [
      { course_id: "elective", degree_requirement_id: "incomplete-elective", status: "confirmed" },
      { course_id: "elective", degree_requirement_id: "complete-elective", status: "confirmed" },
    ]);

    expect(result.incompleteElectives).toEqual([
      expect.objectContaining({ category: "เลือกเสรี", passedCredits: 2, requiredCredits: 6, remainingCredits: 4 }),
    ]);
  });

  it("does not treat name-only suggestions awaiting confirmation as a gap", () => {
    const result = graduationGapSummary(courses, requirements, []);

    expect(result.pendingConfirmations).toBe(1);
    expect(result.missingRequired.map((course) => course.requirementId)).not.toContain("name-required");
    expect(result.notPassedRequired.map((course) => course.requirementId)).not.toContain("name-required");
  });
});
