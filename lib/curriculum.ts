import { normalizedCourseCode } from "@/lib/extraction";
import { Requirement } from "@/lib/types";
import { normalize, similarity } from "@/lib/academic";

export type ExtractedRequirement = {
  category: string;
  type: "required_course" | "elective_credit" | "total_credit";
  code?: string;
  name?: string;
  minimumCredits?: number;
  confidence: Record<string, number>;
};

const courseCode = /\b(\d{8}|[A-Z]{2,}[\s-]?\d{3,4})\b/i;
const credit = /(\d+(?:\.\d+)?)\s*(?:หน่วยกิต|credits?|cr\.?)/i;
const minimumCredit = /(?:ไม่น้อยกว่า|อย่างน้อย|ขั้นต่ำ)?\s*(\d+(?:\.\d+)?)\s*(?:หน่วยกิต|credits?|cr\.?)/i;
const total = /(?:จำนวนหน่วยกิตรวมตลอดหลักสูตร|รวมตลอดหลักสูตร|รวม(?:ไม่น้อยกว่า)?|total)[^\d]{0,80}(\d+(?:\.\d+)?)(?:\s*(?:หน่วยกิต|credits?|cr\.?))?/i;
const elective = /(?:วิชา)?เลือก|elective/i;
const required = /บังคับ|required|core/i;
const summaryCategory = /(หมวดวิชาศึกษาทั่วไป|หมวดวิชาเฉพาะ|กลุ่มสาระ[^\d]{2,100}?|วิชาแกน(?:ทาง[^\d]{2,100}?)?|วิชาเฉพาะด้าน|กลุ่มเทคโนโลยี[^\d]{2,100}?|กลุ่มโครงสร้าง[^\d]{2,100}?|กลุ่มฮาร์ดแวร์[^\d]{2,100}?|กลุ่มทักษะ[^\d]{2,100}?|วิชาเฉพาะเลือก|หมวดวิชาเลือกเสรี|วิชาเลือกเสรี)\s*(?:ไม่น้อยกว่า|อย่างน้อย|ขั้นต่ำ)?\s*(\d+(?:\.\d+)?)\s*(?:หน่วยกิต|credits?|cr\.?)/gi;

/** Parse the useful requirement rows from editable curriculum OCR text. */
export function parseCurriculum(text: string): ExtractedRequirement[] {
  const rows = text.split(/\r?\n/).map(row => row.replace(/\s+/g, " ").trim()).filter(Boolean);
  const requirements: ExtractedRequirement[] = [];
  let category = "ข้อกำหนดหลักสูตร";
  let section: "required" | "elective" | null = null;

  for (const row of rows) {
    const totalMatch = row.match(total);
    if (totalMatch) {
      requirements.push({ category: "หน่วยกิตรวม", type: "total_credit", minimumCredits: Number(totalMatch[1]), confidence: { credits: .9 } });
      continue;
    }
    if (/^(?:หมวด|กลุ่ม|category|general education|วิชาเฉพาะ)/i.test(row)) category = row;
    if (required.test(row)) section = "required";
    if (elective.test(row)) section = "elective";

    const code = row.match(courseCode)?.[1];
    const credits = row.match(credit)?.[1];
    if (code && section === "required") {
      const name = row.slice((row.indexOf(code) + code.length)).replace(credit, "").replace(/^[-:.\s]+/, "").trim();
      requirements.push({ category, type: "required_course", code: normalizedCourseCode(code), name: name || undefined, minimumCredits: credits ? Number(credits) : undefined, confidence: { code: .95, name: name ? .72 : .4 } });
    } else if (section === "elective" && credits && !code) {
      requirements.push({ category, type: "elective_credit", minimumCredits: Number(credits), confidence: { credits: .8 } });
      section = null;
    }
  }

  // PDF.js commonly returns a whole page as one line. Parse the curriculum
  // summary independently so Thai category headings are not lost with layout.
  const summaryText = text.replace(/\s+/g, " ").replace(/\b(\d+)\s+(\d+)\b(?=\s*(?:หน่วยกิต|credits?|cr\.?))/gi, "$1$2").replace(/วิชา\s+เฉพาะ\s+เลือก/g, "วิชาเฉพาะเลือก");
  for (const match of summaryText.matchAll(summaryCategory)) {
    const category = match[1].replace(/\s+/g, " ").trim();
    requirements.push({ category, type: "elective_credit", minimumCredits: Number(match[2]), confidence: { category: .92, credits: .95 } });
  }
  const overallTotal = summaryText.match(total);
  if (overallTotal) requirements.push({ category: "หน่วยกิตรวม", type: "total_credit", minimumCredits: Number(overallTotal[1]), confidence: { credits: .95 } });

  const seen = new Set<string>();
  return requirements.filter(requirement => {
    const key = `${requirement.type}:${requirement.code || ""}:${requirement.minimumCredits || ""}:${requirement.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type CourseMatchCandidate = { requirementId: string; confidence: number; reason: "code" | "name" };
export function suggestRequirement(course: { code: string; nameTh: string; nameEn?: string }, requirements: Requirement[]): CourseMatchCandidate | null {
  const courseCodeValue = normalizedCourseCode(course.code);
  const exact = requirements.find(requirement => requirement.type === "required_course" && requirement.code && normalizedCourseCode(requirement.code) === courseCodeValue);
  if (exact) return { requirementId: exact.id, confidence: 1, reason: "code" };
  const names = [course.nameTh, course.nameEn].filter(Boolean) as string[];
  let best: CourseMatchCandidate | null = null;
  for (const requirement of requirements) {
    if (requirement.type !== "required_course" || !requirement.name) continue;
    const score = Math.max(...names.map(name => similarity(name, requirement.name!)));
    if (score >= .56 && (!best || score > best.confidence)) best = { requirementId: requirement.id, confidence: score, reason: "name" };
  }
  return best;
}

export function sameCourseCode(a: string, b: string) { return normalize(a) === normalize(b); }
