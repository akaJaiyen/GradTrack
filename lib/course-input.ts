import { z } from "zod";
import { academicTerms } from "@/lib/academic-term";

const grade = z.enum(["A", "B+", "B", "C+", "C", "D+", "D", "F", "P", "S", "W", "I", "N"]);

export const courseInputSchema = z.object({
  code: z.string().trim().min(1).max(40),
  nameTh: z.string().trim().max(250).optional(),
  nameEn: z.string().trim().max(250).optional(),
  credits: z.number().positive().max(99),
  grade: grade.optional().nullable(),
  term: z.enum(academicTerms).optional().nullable(),
  year: z.number().int().min(1900).max(3000).optional().nullable(),
  verified: z.boolean().optional(),
  source: z.enum(["transcript", "manual"]).default("manual"),
});

export const courseUpdateSchema = courseInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one course field is required",
);

export type CourseInput = z.infer<typeof courseInputSchema>;

export function courseRow(value: CourseInput, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    code: value.code,
    name_th: value.nameTh || null,
    name_en: value.nameEn || null,
    credits: value.credits,
    grade: value.grade || null,
    term: value.term || null,
    year: value.year || null,
    verified_by_user: value.verified ?? false,
    source: value.source,
  };
}
