import { normalizedCourseCode, type AcademicProfileExtraction } from "@/lib/extraction";
import type { TranscriptDraft } from "@/lib/ku-transcript-parser";

export function aiTranscriptDrafts(extraction: AcademicProfileExtraction, pageCount: number): TranscriptDraft[] {
  return extraction.completedCourses.map((course, index) => {
    const evidence = extraction.evidence.find(item => item.path === `completedCourses.${index}`);
    const header = evidence?.text.match(/(?:(?:First|Second|Third) Semester|Summer Session)\s+(?:19\d{2}|2\d{3})/i)?.[0] || "";
    const rowText = evidence?.text || "";
    const hasCourseEvidence = rowText.includes(course.code) && rowText.includes(String(course.credits)) && (!course.grade || new RegExp(`(?:^|\\s)${course.grade.replace("+", "\\+")}(?:\\s|$)`).test(rowText));
    const hasCleanName = !/(?:^|\s)(?:A|B\+|B|C\+|C|D\+|D|F|P|S|W|I|N)\s+\d/.test(course.name);
    const status = evidence && evidence.page && evidence.page <= pageCount && course.term && course.academicYear && header && hasCourseEvidence && hasCleanName ? "ready" : "needs_review";
    return { code: normalizedCourseCode(course.code), name: course.name, credits: course.credits, grade: course.grade, term: course.term, academicYear: course.academicYear, evidence: { page: evidence?.page || 0, rowText, termHeader: header }, status, parser: "ai" };
  });
}
