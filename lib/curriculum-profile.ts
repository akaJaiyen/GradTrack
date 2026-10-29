import { normalizedCourseCode } from "@/lib/extraction";

export type CurriculumProfile = "ku-cpe-2565";
export type CurriculumNodeKind = "total" | "container" | "required_bucket" | "elective_bucket";
export type CurriculumNode = { id: string; parentId?: string; name: string; minimumCredits: number; kind: CurriculumNodeKind; evidence: string };
export type CatalogCourse = { code: string; nameEn?: string; credits?: number; confidence: number };
export type CurriculumDraft = { profile: CurriculumProfile; nodes: CurriculumNode[]; catalog: CatalogCourse[]; assignments: Record<string, string> };

const kuCpe2565Nodes: CurriculumNode[] = [
  { id: "total", name: "หน่วยกิตรวม", minimumCredits: 138, kind: "total", evidence: "3.1.1" },
  { id: "ge", name: "หมวดวิชาศึกษาทั่วไป", minimumCredits: 30, kind: "container", evidence: "3.1.2.1" },
  { id: "ge-health", parentId: "ge", name: "กลุ่มสาระอยู่ดีมีสุข", minimumCredits: 7, kind: "elective_bucket", evidence: "3.1.2.1" },
  { id: "ge-entrepreneur", parentId: "ge", name: "กลุ่มสาระศาสตร์แห่งผู้ประกอบการ", minimumCredits: 3, kind: "elective_bucket", evidence: "3.1.2.1" },
  { id: "ge-language", parentId: "ge", name: "กลุ่มสาระภาษากับการสื่อสาร", minimumCredits: 15, kind: "elective_bucket", evidence: "3.1.2.1" },
  { id: "ge-citizen", parentId: "ge", name: "กลุ่มสาระพลเมืองไทยและพลเมืองโลก", minimumCredits: 2, kind: "elective_bucket", evidence: "3.1.2.1" },
  { id: "ge-humanities", parentId: "ge", name: "กลุ่มสาระสุนทรียศาสตร์", minimumCredits: 3, kind: "elective_bucket", evidence: "3.1.2.1" },
  { id: "specific", name: "หมวดวิชาเฉพาะ", minimumCredits: 102, kind: "container", evidence: "3.1.2.2" },
  { id: "core", parentId: "specific", name: "วิชาแกน", minimumCredits: 32, kind: "container", evidence: "2.1" },
  { id: "core-science", parentId: "core", name: "วิชาแกนทางวิทยาศาสตร์และคณิตศาสตร์", minimumCredits: 17, kind: "required_bucket", evidence: "2.1" },
  { id: "core-engineering", parentId: "core", name: "วิชาแกนทางวิศวกรรม", minimumCredits: 15, kind: "required_bucket", evidence: "2.1" },
  { id: "specialized", parentId: "specific", name: "วิชาเฉพาะด้าน", minimumCredits: 54, kind: "container", evidence: "2.2" },
  { id: "applied", parentId: "specialized", name: "กลุ่มเทคโนโลยีเพื่องานประยุกต์", minimumCredits: 3, kind: "required_bucket", evidence: "2.2" },
  { id: "software", parentId: "specialized", name: "กลุ่มเทคโนโลยีและวิธีทางซอฟต์แวร์", minimumCredits: 17, kind: "required_bucket", evidence: "2.2" },
  { id: "systems", parentId: "specialized", name: "กลุ่มโครงสร้างพื้นฐานของระบบ", minimumCredits: 13, kind: "required_bucket", evidence: "2.2" },
  { id: "hardware", parentId: "specialized", name: "กลุ่มฮาร์ดแวร์และสถาปัตยกรรมคอมพิวเตอร์", minimumCredits: 16, kind: "required_bucket", evidence: "2.2" },
  { id: "professional", parentId: "specialized", name: "กลุ่มทักษะวิชาชีพและจรรยาบรรณ", minimumCredits: 5, kind: "required_bucket", evidence: "2.2" },
  { id: "specific-elective", parentId: "specific", name: "วิชาเฉพาะเลือก", minimumCredits: 16, kind: "elective_bucket", evidence: "2.3" },
  { id: "free-elective", name: "หมวดวิชาเลือกเสรี", minimumCredits: 6, kind: "elective_bucket", evidence: "3" },
];

export function parseKuCpe2565Summary(text: string): CurriculumDraft | null {
  const normalized = text.replace(/\s+/g, " ").replace(/\b(\d+)\s+(\d+)\b(?=\s*(?:หน่วยกิต|credits?))/gi, "$1$2").replace(/จำนวนหน่วยกิต\s+รวม/g, "จำนวนหน่วยกิตรวม").replace(/วิชา\s+เฉพาะ\s+เลือก/g, "วิชาเฉพาะเลือก");
  const hasSignature = /(?:138\s*(?:หน่วยกิต|credits?)|หน่วยกิตรวมตลอดหลักสูตร)/i.test(normalized) && /(?:วิชาเฉพาะเลือก|specific elective)/i.test(normalized);
  return hasSignature ? { profile: "ku-cpe-2565", nodes: kuCpe2565Nodes, catalog: [], assignments: {} } : null;
}

export function parseKuCpe2565Catalog(text: string): CatalogCourse[] {
  const codePattern = /\b\d{8}\b/g;
  const codes = [...text.matchAll(codePattern)];
  const seen = new Set<string>();
  return codes.flatMap((match, index) => {
    const code = normalizedCourseCode(match[0]);
    if (seen.has(code)) return [];
    const end = index + 1 < codes.length ? codes[index + 1].index! : Math.min(text.length, (match.index || 0) + 900);
    const chunk = text.slice(match.index, end);
    const details = chunk.slice(match[0].length);
    const nameEn = chunk.match(/\(([A-Z][A-Za-z ,.'’&/-]{2,180})\)/)?.[1]?.replace(/\s+/g, " ").trim();
    const credits = Number(details.match(/\b(\d)(?:\s*\(\d-\d-\d\))?/)?.[1]);
    if (!nameEn || !Number.isFinite(credits) || credits <= 0) return [];
    seen.add(code);
    return [{ code, nameEn, credits, confidence: .8 }];
  });
}
