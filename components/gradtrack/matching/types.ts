export type MatchStatus = "passed" | "not_passed" | "missing" | "needs_confirmation";
export type Candidate = { id: string; code: string; name: string; score: number; grade: string | null };
export type RequiredCourse = { requirementId: string; category: string; code: string | null; name: string | null; credits: number | null; status: MatchStatus; candidates: Candidate[] };
export type ElectiveCategory = { requirementIds: string[]; category: string; requiredCredits: number; passedCredits: number; status: "complete" | "in_progress" | "empty"; matchedCourses: Array<Candidate & { credits: number }> };
export type MatchableRequirement = Pick<RequiredCourse, "requirementId">;
export type MatchingData = { courses: Candidate[]; progress: { totalCredits: number | null; passedCredits: number; passedRequired: number; pendingConfirmations: number; required: RequiredCourse[]; electives: ElectiveCategory[] } };
export type MatchingApiResponse = Omit<MatchingData, "courses"> & { courses: Array<{ id: string; code: string; name_th: string | null; grade: string | null }> };
