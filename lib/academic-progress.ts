import { normalize, similarity } from "@/lib/academic";
import { passingGrades, type Grade } from "@/lib/types";

export type ProgressCourse = { id: string; code: string; name_th: string | null; credits: number | string; grade: string | null };
export type ProgressRequirement = { id: string; category_name: string; requirement_type: "required_course" | "elective_credit" | "total_credit"; required_course_code: string | null; required_course_name: string | null; minimum_credits: number | string | null };
export type ProgressMatch = { course_id: string; degree_requirement_id: string; status: "confirmed" | "needs_review" };

export type RequiredCourseProgress = {
  requirementId: string;
  category: string;
  code: string | null;
  name: string | null;
  credits: number | null;
  status: "passed" | "not_passed" | "missing" | "needs_confirmation";
  candidates: Array<{ id: string; code: string; name: string; score: number; grade: string | null }>;
};

export function curriculumProgress(courses: ProgressCourse[], requirements: ProgressRequirement[], matches: ProgressMatch[]) {
  const passedCourses = courses.filter(course => Boolean(course.grade && passingGrades.has(course.grade as Grade)));
  const confirmed = new Set(matches.filter(match => match.status === "confirmed").map(match => `${match.course_id}:${match.degree_requirement_id}`));
  const required = requirements.filter(requirement => requirement.requirement_type === "required_course").map(requirement => {
    const code = requirement.required_course_code;
    const name = requirement.required_course_name;
    const codePrefix = code?.match(/^([0-9]+)X+$/i)?.[1] || null;
    const candidates = code
      ? courses.filter(course => codePrefix ? normalize(course.code).startsWith(codePrefix) : normalize(course.code) === normalize(code)).map(course => ({ id: course.id, code: course.code, name: course.name_th || "—", score: 1, grade: course.grade }))
      : courses.flatMap(course => {
        const score = name && course.name_th ? similarity(name, course.name_th) : 0;
        return score >= .7 ? [{ id: course.id, code: course.code, name: course.name_th || "—", score, grade: course.grade }] : [];
      }).sort((a, b) => b.score - a.score);
    const passing = candidates.find(course => course.grade && passingGrades.has(course.grade as Grade));
    const status = code
      ? passing ? "passed" : candidates.length ? "not_passed" : "missing"
      : passing && confirmed.has(`${passing.id}:${requirement.id}`) ? "passed" : candidates.length ? "needs_confirmation" : "missing";
    return { requirementId: requirement.id, category: requirement.category_name, code, name, credits: requirement.minimum_credits === null ? null : Number(requirement.minimum_credits), status, candidates } satisfies RequiredCourseProgress;
  });
  const total = requirements.find(requirement => requirement.requirement_type === "total_credit")?.minimum_credits;
  const passedCredits = passedCourses.reduce((sum, course) => sum + Number(course.credits), 0);
  return {
    totalCredits: total === undefined || total === null ? null : Number(total),
    passedCredits,
    required,
    passedRequired: required.filter(item => item.status === "passed").length,
    pendingConfirmations: required.filter(item => item.status === "needs_confirmation").length,
  };
}
