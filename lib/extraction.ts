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
  courses: z.array(extractedCourseSchema).max(500),
});
export type Extraction = z.infer<typeof extractionSchema>;

export function normalizedCourseCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
