import type { Course, Grade, Requirement } from "@/lib/types";
import { normalizeAcademicTerm } from "@/lib/academic-term";

export type View =
  | "overview"
  | "upload"
  | "review"
  | "matching"
  | "scenarios"
  | "planner"
  | "privacy";
export type Tab = "curriculum" | "student";
export type Doc = {
  id: string;
  type: string;
  file_name: string;
  status: string;
  extraction_error?: string | null;
  created_at: string;
};

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
export const documentStatusLabels: Record<string, string> = {
  uploaded: "อัปโหลดแล้ว",
  extracting: "กำลังอ่าน",
  review_needed: "ต้องตรวจสอบ",
  ready: "พร้อมใช้",
  failed: "อ่านไม่สำเร็จ",
  rate_limited: "โควตา AI หมด",
};

export async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.error?.message ||
        "Request failed",
    );
  return response.json();
}
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
