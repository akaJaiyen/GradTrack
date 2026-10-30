import { gradeSummary } from "@/lib/academic";
import type { Course } from "@/lib/types";

export type TermSummary = ReturnType<typeof gradeSummary>;
export type CourseTermGroup = {
  key: string;
  label: string;
  term: string | null;
  year: number | null;
  courses: Course[];
  summary: TermSummary;
  cumulative: TermSummary;
};

const unassigned = (course: { term?: string | null; year?: number | null }) => !course.term && !course.year;

function compareTerms(left: Pick<CourseTermGroup, "term" | "year">, right: Pick<CourseTermGroup, "term" | "year">) {
  if (unassigned(left)) return -1;
  if (unassigned(right)) return 1;
  if (left.year !== right.year) return (left.year || 0) - (right.year || 0);
  const leftNumber = Number(left.term);
  const rightNumber = Number(right.term);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) return leftNumber - rightNumber;
  return (left.term || "").localeCompare(right.term || "", "th");
}

export function groupCoursesByTerm(courses: Course[]): CourseTermGroup[] {
  const grouped = new Map<string, Omit<CourseTermGroup, "summary" | "cumulative">>();
  for (const course of courses) {
    const term = course.term?.trim() || null;
    const year = course.year ?? null;
    const key = `${year ?? "unknown"}:${term ?? "unknown"}`;
    const existing = grouped.get(key);
    if (existing) existing.courses.push(course);
    else grouped.set(key, {
      key,
      term,
      year,
      label: term || year ? [year ? `ปีการศึกษา ${year}` : null, term ? `เทอม ${term}` : null].filter(Boolean).join(" · ") : "ไม่ระบุเทอม",
      courses: [course],
    });
  }

  const terms = [...grouped.values()]
    .map((group) => ({ ...group, summary: gradeSummary(group.courses) }))
    .sort(compareTerms);
  let cumulativeCourses: Course[] = [];
  return terms.map((group) => {
    cumulativeCourses = [...cumulativeCourses, ...group.courses];
    return { ...group, cumulative: gradeSummary(cumulativeCourses) };
  });
}
