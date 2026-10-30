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
});
