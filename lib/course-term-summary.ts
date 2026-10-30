import { gradeSummary } from "@/lib/academic";
import { academicTermLabels, academicTermRank, normalizeAcademicTerm, type AcademicTerm } from "@/lib/academic-term";
import type { Course } from "@/lib/types";

export type TermSummary = ReturnType<typeof gradeSummary>;
export type CourseTermGroup = {
  key: string;
  label: string;
  term: AcademicTerm | null;
  year: number | null;
  courses: Course[];
  summary: TermSummary;
  cumulative: TermSummary;
};

const unassigned = (course: { term?: string | null }) => !course.term;

function compareTerms(left: Pick<CourseTermGroup, "term" | "year">, right: Pick<CourseTermGroup, "term" | "year">) {
  if (unassigned(left) && unassigned(right)) return (left.year || 0) - (right.year || 0);
  if (unassigned(left)) return 1;
  if (unassigned(right)) return -1;
  if (left.year !== right.year) return (left.year || 0) - (right.year || 0);
  return academicTermRank[left.term!] - academicTermRank[right.term!];
}

export function groupCoursesByTerm(courses: Course[]): CourseTermGroup[] {
  const grouped = new Map<string, Omit<CourseTermGroup, "summary" | "cumulative">>();
  for (const course of courses) {
    const term = normalizeAcademicTerm(course.term);
    const year = course.year ?? null;
    const key = `${year ?? "unknown"}:${term ?? "unknown"}`;
    const existing = grouped.get(key);
    if (existing) existing.courses.push(course);
    else grouped.set(key, {
      key,
      term,
      year,
      label: year ? `ปีการศึกษา ${year} · ${term ? academicTermLabels[term] : "ไม่ระบุเทอม"}` : term ? academicTermLabels[term] : "ไม่ระบุเทอม",
      courses: [course],
    });
  }

  const terms = [...grouped.values()]
    .map((group) => ({ ...group, summary: gradeSummary(group.courses) }))
    .sort(compareTerms);
  let cumulativeCourses: Course[] = [];
  const chronological = terms.map((group) => {
    cumulativeCourses = [...cumulativeCourses, ...group.courses];
    return { ...group, cumulative: gradeSummary(cumulativeCourses) };
  });
  const unassignedTerms = chronological.filter(unassigned).reverse();
  return [...chronological.filter(group => !unassigned(group)).reverse(), ...unassignedTerms];
}
