import { Course, Grade, PlannedCourse, Requirement, gradePoints, passingGrades } from "@/lib/types";

export const normalize = (value = "") => value.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
export function gradeSummary(courses: Array<Pick<Course, "credits" | "grade">>) {
  let points = 0, gradedCredits = 0, passedCredits = 0;
  for (const course of courses) {
    if (course.grade && passingGrades.has(course.grade)) passedCredits += course.credits;
    const point = course.grade ? gradePoints[course.grade] : undefined;
    if (point !== undefined) { points += point * course.credits; gradedCredits += course.credits; }
  }
  return { gpa: gradedCredits ? Number((points / gradedCredits).toFixed(2)) : 0, passedCredits, gradedCredits };
}
export function conflict(a: PlannedCourse, b: PlannedCourse) {
  return a.meetings.some(x => b.meetings.some(y => x.weekday === y.weekday && x.startTime < y.endTime && y.startTime < x.endTime));
}
export function prerequisitesMet(requirement: Requirement | undefined, completed: Course[], planned: PlannedCourse[]) {
  if (!requirement?.prerequisiteCodes?.length) return true;
  const codes = new Set([...completed.filter(c => c.grade && passingGrades.has(c.grade)).map(c => normalize(c.code)), ...planned.map(c => normalize(c.code))]);
  return requirement.prerequisiteCodes.every(code => codes.has(normalize(code)));
}
export function similarity(a: string, b: string) {
  const left = normalize(a), right = normalize(b); if (!left || !right) return 0; if (left === right) return 1;
  const grams = (x: string) => new Set(Array.from({ length: Math.max(0, x.length - 1) }, (_, i) => x.slice(i, i + 2)));
  const x = grams(left), y = grams(right), intersection = [...x].filter(g => y.has(g)).length;
  return Number((2 * intersection / (x.size + y.size || 1)).toFixed(2));
}
export function calculateProgress(courses: Course[], requirements: Requirement[]) {
  const passed = courses.filter(c => c.grade && passingGrades.has(c.grade));
  const passedCredits = passed.reduce((sum, c) => sum + c.credits, 0);
  const total = requirements.find(r => r.type === "total_credit")?.minimumCredits ?? 0;
  return { passedCredits, totalCredits: total, percentage: total ? Math.min(100, Math.round(passedCredits / total * 100)) : 0 };
}
