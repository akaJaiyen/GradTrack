import type { Course, Grade, Requirement } from "@/lib/types";
import { normalizeAcademicTerm } from "@/lib/academic-term";

export type Tab = "curriculum" | "student";

export const grades: Grade[] = [
  "A",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "F",
  "P",
  "S",
  "W",
  "I",
  "N",
];
export const fromCourse = (value: any): Course => ({
  id: value.id,
  code: value.code,
  nameTh: value.name_th || "",
  credits: Number(value.credits),
  grade: value.grade || undefined,
  term: normalizeAcademicTerm(value.term) || undefined,
  year: value.year === null || value.year === undefined ? undefined : Number(value.year),
  verified: value.verified_by_user ?? undefined,
});
export const fromRequirement = (value: any): Requirement => ({
  id: value.id,
  category: value.category_name,
  type: value.requirement_type,
  code: value.required_course_code || undefined,
  name: value.required_course_name || undefined,
  minimumCredits:
    value.minimum_credits === null ? undefined : Number(value.minimum_credits),
});
export const coursePayload = (value: Course) => ({
  code: value.code,
  nameTh: value.nameTh,
  credits: Number(value.credits),
  grade: value.grade || null,
  term: value.term || null,
  year: value.year || null,
  verified: true,
  source: "manual",
});
