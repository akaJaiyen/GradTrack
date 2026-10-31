import { curriculumProgress, type ElectiveCreditProgress, type RequiredCourseProgress } from "@/lib/academic-progress";
import type { ConfirmedMatch } from "@/lib/academic";
import type { Course, Requirement } from "@/lib/types";

export type IncompleteElective = ElectiveCreditProgress & { remainingCredits: number };

export type GraduationGapSummary = {
  missingRequired: RequiredCourseProgress[];
  notPassedRequired: RequiredCourseProgress[];
  incompleteElectives: IncompleteElective[];
  pendingConfirmations: number;
  hasGaps: boolean;
};

/** Summarizes curriculum requirements which still need student action. */
export function graduationGapSummary(
  courses: Course[],
  requirements: Requirement[],
  matches: ConfirmedMatch[],
): GraduationGapSummary {
  const progress = curriculumProgress(
    courses.map((course) => ({
      id: course.id,
      code: course.code,
      name_th: course.nameTh || null,
      credits: course.credits,
      grade: course.grade || null,
    })),
    requirements.map((requirement) => ({
      id: requirement.id,
      category_name: requirement.category,
      requirement_type: requirement.type,
      required_course_code: requirement.code || null,
      required_course_name: requirement.name || null,
      minimum_credits: requirement.minimumCredits ?? null,
    })),
    matches,
  );

  const missingRequired = progress.required.filter((requirement) => requirement.status === "missing");
  const notPassedRequired = progress.required.filter((requirement) => requirement.status === "not_passed");
  const incompleteElectives = progress.electives
    .filter((elective) => elective.status !== "complete")
    .map((elective) => ({ ...elective, remainingCredits: elective.requiredCredits - elective.passedCredits }));

  return {
    missingRequired,
    notPassedRequired,
    incompleteElectives,
    pendingConfirmations: progress.pendingConfirmations,
    hasGaps: Boolean(missingRequired.length || notPassedRequired.length || incompleteElectives.length),
  };
}
