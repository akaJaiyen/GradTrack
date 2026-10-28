import { Grade } from "@/lib/types";
import { normalizedCourseCode } from "@/lib/extraction";
const codePattern = /\b([A-Z]{2,}[\s-]?\d{3,4})\b/g;
const gradePattern = /\b(A|B\+|B|C\+|C|D\+|D|F|P|S|W|I)\b/;
export type ExtractedCourse = { code: string; name: string; credits?: number; grade?: Grade; confidence: Record<string, number> };
export function parseTranscript(text: string): ExtractedCourse[] {
  return text.split(/\r?\n/).flatMap(line => {
    const code = normalizedCourseCode([...line.matchAll(codePattern)][0]?.[1] || ""); if (!code) return [];
    const grade = line.match(gradePattern)?.[1] as Grade | undefined;
    const credits = Number(line.match(/\b([1-6](?:\.\d)?)\b/)?.[1]);
    const name = line.replace(codePattern, "").replace(gradePattern, "").replace(/\b[1-6](?:\.\d)?\b/, "").trim();
    return [{ code, name, credits: Number.isFinite(credits) ? credits : undefined, grade, confidence: { code: .94, name: name ? .65 : .15, credits: credits ? .6 : .1, grade: grade ? .8 : .1 } }];
  });
}
