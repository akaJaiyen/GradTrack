import { CatalogCourse, CurriculumNode } from "@/lib/curriculum-profile";

export function validateCurriculumDraft(nodes: CurriculumNode[], catalog: CatalogCourse[], assignments: Record<string, string>) {
  if (!nodes.length || nodes.some(node => !node.name.trim() || !Number.isFinite(node.minimumCredits) || node.minimumCredits < 0)) return "กรุณากรอกชื่อหมวดและหน่วยกิตให้ถูกต้อง";
  const total = nodes.find(node => node.kind === "total");
  if (!total) return "ต้องมีหน่วยกิตรวมของหลักสูตร";
  const children = (parentId?: string) => nodes.filter(node => node.parentId === parentId);
  if (children(undefined).filter(node => node.kind !== "total").reduce((sum, node) => sum + node.minimumCredits, 0) !== total.minimumCredits) return "ยอดหน่วยกิตระดับบนต้องเท่ากับหน่วยกิตรวม";
  for (const parent of nodes.filter(node => node.kind === "container")) if (children(parent.id).reduce((sum, node) => sum + node.minimumCredits, 0) !== parent.minimumCredits) return `ยอดหน่วยกิตใน ${parent.name} ไม่สมดุล`;
  for (const bucket of nodes.filter(node => node.kind === "required_bucket")) {
    const credits = catalog.filter(course => assignments[course.code] === bucket.id).reduce((sum, course) => sum + (course.credits || 0), 0);
    if (credits !== bucket.minimumCredits) return `รายวิชาใน ${bucket.name} ต้องรวม ${bucket.minimumCredits} หน่วยกิต`;
  }
  return null;
}
