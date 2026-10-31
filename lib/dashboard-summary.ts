import { calculateProgress, gradeSummary, type ConfirmedMatch } from "@/lib/academic";
import { groupCoursesByTerm } from "@/lib/course-term-summary";
import type { Course, Requirement } from "@/lib/types";

export type DashboardState = "no_transcript" | "grades_only" | "ready_without_matches" | "ready";

export function dashboardSummary(
  courses: Course[],
  requirements: Requirement[],
  matches: ConfirmedMatch[],
) {
  const terms = groupCoursesByTerm(courses);
  const confirmedMatches = matches.filter((match) => match.status === "confirmed");
  const hasGraduationTarget = requirements.some((requirement) => requirement.type === "total_credit");
  const progress = hasGraduationTarget && confirmedMatches.length
    ? calculateProgress(courses, requirements, confirmedMatches)
    : null;
  const state: DashboardState = !courses.length
    ? "no_transcript"
    : !hasGraduationTarget
      ? "grades_only"
      : !progress
        ? "ready_without_matches"
        : "ready";

  return {
    state,
    overall: gradeSummary(courses),
    terms,
    latestTerm: terms[0] ?? null,
    latestCourses: terms[0]?.courses ?? [],
    progress,
  };
}
