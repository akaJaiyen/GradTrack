export type DocumentType = "curriculum" | "transcript";
export type DocumentStatus = "uploaded" | "extracting" | "review_needed" | "ready" | "failed";
export type Grade = "A" | "B+" | "B" | "C+" | "C" | "D+" | "D" | "F" | "P" | "S" | "W" | "I" | "N";
export type Course = { id: string; code: string; nameTh: string; nameEn?: string; credits: number; grade?: Grade; term?: string; year?: number; verified?: boolean };
export type Requirement = { id: string; category: string; type: "required_course" | "elective_credit" | "total_credit"; code?: string; name?: string; minimumCredits?: number; prerequisiteCodes?: string[]; verified?: boolean };
export type Meeting = { id: string; weekday: number; startTime: string; endTime: string };
export type PlannedCourse = { id: string; code: string; name: string; credits: number; section?: string; color: string; expectedGrade?: Grade; meetings: Meeting[]; notes?: string };
export type StudyPlan = { id: string; name: string; academicTerm: string; academicYear: string; courses: PlannedCourse[] };
export type Scenario = { id: string; name: string; description?: string; grades: Record<string, Grade> };

export const gradePoints: Partial<Record<Grade, number>> = { A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, "D+": 1.5, D: 1, F: 0 };
export const passingGrades = new Set<Grade>(["A", "B+", "B", "C+", "C", "D+", "D", "P", "S"]);
