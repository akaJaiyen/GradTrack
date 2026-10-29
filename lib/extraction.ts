import { z } from "zod";

export const gradeSchema = z.enum(["A", "B+", "B", "C+", "C", "D+", "D", "F", "P", "S", "W", "I", "N"]);
export const extractedCourseSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().max(250),
  credits: z.number().positive().max(99).optional(),
  grade: gradeSchema.optional(),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});
export const confirmedCourseSchema = extractedCourseSchema.extend({ name: z.string().trim().min(1).max(250), credits: z.number().positive().max(99) });
export const extractionSchema = z.object({
  text: z.string().max(2_000_000).optional(),
  courses: z.array(extractedCourseSchema).max(500).default([]),
  requirements: z.array(z.object({
    category: z.string().trim().min(1).max(160),
    type: z.enum(["required_course", "elective_credit", "total_credit"]),
    code: z.string().trim().max(40).optional(),
    name: z.string().trim().max(250).optional(),
    minimumCredits: z.number().nonnegative().max(999).optional(),
    confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  })).max(500).default([]),
  curriculumDraft: z.object({
    profile: z.literal("ku-cpe-2565"),
    nodes: z.array(z.object({ id: z.string(), parentId: z.string().optional(), name: z.string(), minimumCredits: z.number().nonnegative(), kind: z.enum(["total", "container", "required_bucket", "elective_bucket"]), evidence: z.string() })).max(100),
    catalog: z.array(z.object({ code: z.string(), nameEn: z.string().optional(), credits: z.number().positive().optional(), confidence: z.number().min(0).max(1) })).max(500),
    assignments: z.record(z.string(), z.string()),
  }).optional(),
});
export type Extraction = z.infer<typeof extractionSchema>;

export function normalizedCourseCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
