export const academicTerms = ["1", "2", "3", "summer"] as const;
export type AcademicTerm = typeof academicTerms[number];

export const academicTermLabels: Record<AcademicTerm, string> = {
  "1": "เทอม 1",
  "2": "เทอม 2",
  "3": "เทอม 3",
  summer: "Summer",
};

export const academicTermRank: Record<AcademicTerm, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  summer: 4,
};

export function normalizeAcademicTerm(value: unknown): AcademicTerm | null {
  if (typeof value !== "string") return null;
  const term = value.trim().toLowerCase();
  if (!term) return null;
  if (academicTerms.includes(term as AcademicTerm)) return term as AcademicTerm;
  if (/summer|ฤดูร้อน/.test(term)) return "summer";
  if (/^\s*1\s*$|\b(first|1st)\b|\b(?:semester|term|sem\.?)[\s-]*(1|i)\b|เทอม\s*1\b|ภาคต้น/.test(term)) return "1";
  if (/^\s*2\s*$|\b(second|2nd)\b|\b(?:semester|term|sem\.?)[\s-]*(2|ii)\b|เทอม\s*2\b|ภาคปลาย/.test(term)) return "2";
  if (/^\s*3\s*$|\b(third|3rd)\b|\b(?:semester|term|sem\.?)[\s-]*(3|iii)\b|เทอม\s*3\b/.test(term)) return "3";
  return null;
}

export function academicYearFromText(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const year = value.match(/\b(?:19\d{2}|2\d{3}|3000)\b/)?.[0];
  return year ? Number(year) : null;
}

export function normalizeAcademicTermAndYear(term: unknown, academicYear: number | null) {
  return {
    term: normalizeAcademicTerm(term),
    academicYear: academicYear ?? academicYearFromText(term),
  };
}
