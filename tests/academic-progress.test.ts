import { describe, expect, it } from "vitest";
import { curriculumProgress } from "@/lib/academic-progress";

const coded = { id: "course-1", code: "CS 101", name_th: "Programming", credits: 3, grade: "A" };
const named = { id: "course-2", code: "GE 100", name_th: "Thai Communication", credits: 3, grade: "B+" };

describe("curriculum progress", () => {
  it("uses the curriculum total supplied by the requirement, not a fixed credit target", () => {
    const result = curriculumProgress([coded], [
      { id: "total", category_name: "credits", requirement_type: "total_credit", required_course_code: null, required_course_name: null, minimum_credits: 121 },
      { id: "coded", category_name: "core", requirement_type: "required_course", required_course_code: "CS101", required_course_name: "Programming", minimum_credits: 3 },
    ], []);
    expect(result.totalCredits).toBe(121);
    expect(result.required[0].status).toBe("passed");
  });

  it("keeps name-only requirements pending until the user confirms the suggested match", () => {
    const requirements = [{ id: "named", category_name: "GE", requirement_type: "required_course" as const, required_course_code: null, required_course_name: "Thai Communication", minimum_credits: 3 }];
    const before = curriculumProgress([named], requirements, []);
    expect(before.required[0].status).toBe("needs_confirmation");
    expect(before.required[0].candidates[0].id).toBe("course-2");
    const after = curriculumProgress([named], requirements, [{ course_id: "course-2", degree_requirement_id: "named", status: "confirmed" as const }]);
    expect(after.required[0].status).toBe("passed");
  });

  it("does not count a matching course with a non-passing grade", () => {
    const result = curriculumProgress([{ ...coded, grade: "F" }], [{ id: "coded", category_name: "core", requirement_type: "required_course", required_course_code: "CS101", required_course_name: "Programming", minimum_credits: 3 }], []);
    expect(result.required[0].status).toBe("not_passed");
  });

  it("uses an x-suffixed code as a course-code prefix", () => {
    const result = curriculumProgress([{ ...coded, code: "01175123" }], [{ id: "prefix", category_name: "กิจกรรม", requirement_type: "required_course", required_course_code: "01175XXX", required_course_name: "กิจกรรมพลศึกษา", minimum_credits: 1 }], []);
    expect(result.required[0].status).toBe("passed");
  });

  it("shows a user-confirmed manual match even when the course code differs", () => {
    const result = curriculumProgress([named], [{ id: "required", category_name: "GE", requirement_type: "required_course", required_course_code: "GE101", required_course_name: "Thai", minimum_credits: 3 }], [{ course_id: "course-2", degree_requirement_id: "required", status: "confirmed" }]);
    expect(result.required[0]).toMatchObject({ status: "passed" });
    expect(result.required[0].candidates[0]).toMatchObject({ id: "course-2", code: "GE 100" });
  });

  it("counts only confirmed passing courses in each elective category", () => {
    const result = curriculumProgress([coded, named], [{ id: "elective", category_name: "วิชาเลือกเสรี", requirement_type: "elective_credit", required_course_code: null, required_course_name: null, minimum_credits: 6 }], [{ course_id: "course-1", degree_requirement_id: "elective", status: "confirmed" }]);
    expect(result.electives[0]).toMatchObject({ category: "วิชาเลือกเสรี", passedCredits: 3, requiredCredits: 6, status: "in_progress" });
    expect(result.electives[0].matchedCourses).toHaveLength(1);
    expect(result.electives[0].matchedCourses[0]).toMatchObject({ name: "Programming" });
  });

  it("groups only exactly equal elective category names", () => {
    const result = curriculumProgress([], [
      { id: "same-1", category_name: "วิชา ภาษาต่างประเทศ 1 ภาษา", requirement_type: "elective_credit", required_course_code: null, required_course_name: null, minimum_credits: 3 },
      { id: "same-2", category_name: "วิชา ภาษาต่างประเทศ 1 ภาษา", requirement_type: "elective_credit", required_course_code: null, required_course_name: null, minimum_credits: 3 },
      { id: "different", category_name: "ภาษาต่างประเทศ 1 ภาษา", requirement_type: "elective_credit", required_course_code: null, required_course_name: null, minimum_credits: 3 },
    ], []);
    expect(result.electives).toHaveLength(2);
    expect(result.electives[0]).toMatchObject({ requiredCredits: 6, requirementIds: ["same-1", "same-2"] });
  });

});
