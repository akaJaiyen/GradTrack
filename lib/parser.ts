import { Grade } from "@/lib/types";
import { normalizedCourseCode } from "@/lib/extraction";
const codePattern = /\b(\d{8}|[A-Z]{2,}[\s-]?\d{3,4})\b/g;
const resultPattern = /(?:^|\s)(A|B\+|B|C\+|C|D\+|D|F|P|S|W|I|N)\s+([1-9](?:\.\d)?)(?:\*)?(?=\s|$)/g;
export type ExtractedCourse = { code: string; name: string; credits?: number; grade?: Grade; confidence: Record<string, number> };
export function parseTranscript(text: string): ExtractedCourse[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const codes = [...normalized.matchAll(codePattern)];
  return codes.flatMap((codeMatch, index) => {
    const start = (codeMatch.index || 0) + codeMatch[0].length;
    const end = index + 1 < codes.length ? codes[index + 1].index! : normalized.length;
    const section = normalized.slice(start, end).trim();
    const result = [...section.matchAll(resultPattern)][0];
    if (!result) return [];
    const name = section.slice(0, result.index).trim();
    if (!name) return [];
    return [{ code: normalizedCourseCode(codeMatch[1]), name, credits: Number(result[2]), grade: result[1] as Grade, confidence: { code: .94, name: .8, credits: .9, grade: .9 } }];
  });
}
