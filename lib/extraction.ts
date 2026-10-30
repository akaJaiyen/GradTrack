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

/**
 * Canonical, provider-neutral representation of every academic document a
 * workspace uploads.  It deliberately contains all sections even when a
 * particular source is only a transcript or only a curriculum document.
 */
const nullableText = z.string().trim().max(250).nullable().default(null);
const sourceKindSchema = z.enum(["curriculum", "catalog", "transcript", "mixed", "unknown"]);
const requiredCourseSchema = z.object({
  /** Stable within the saved extraction; never use a guessed course code as the id. */
  id: z.string().trim().min(1).max(160),
  groupId: z.string().trim().min(1).max(100).nullable().default(null),
  code: z.string().trim().min(2).max(40).nullable().default(null),
  nameTh: nullableText,
  nameEn: nullableText,
  credits: z.number().positive().max(99).nullable().default(null),
  evidencePath: z.string().trim().min(1).max(500).default("curriculum.requiredCourses"),
}).refine(course => Boolean(course.code || course.nameTh || course.nameEn), {
  message: "A required course needs a code or a name",
});
export const academicProfileExtractionSchema = z.object({
  profile: z.object({
    institution: nullableText,
    program: nullableText,
    degreeLevel: z.enum(["bachelor", "master", "doctorate", "certificate", "unknown"]).default("unknown"),
    curriculumYear: nullableText,
    languages: z.array(z.string().trim().min(2).max(20)).max(10).default([]),
    status: z.enum(["ready", "ready_with_warnings"]).default("ready"),
  }),
  curriculum: z.object({
    totalCreditsRequired: z.number().positive().max(999).nullable().default(null),
    requirementGroups: z.array(z.object({
      id: z.string().trim().min(1).max(100),
      parentId: z.string().trim().min(1).max(100).nullable().default(null),
      name: z.string().trim().min(1).max(250),
      kind: z.enum(["total", "container", "required_bucket", "elective_bucket", "credit_bucket"]),
      minimumCredits: z.number().nonnegative().max(999).nullable().default(null),
      requiredCourseCodes: z.array(z.string().trim().min(2).max(40)).max(500).default([]),
    })).max(200).default([]),
    // Kept separate from a catalogue: a study plan can require a named course
    // without publishing a course code, and that name must not be discarded.
    requiredCourses: z.array(requiredCourseSchema).max(1000).default([]),
  }),
  catalogCourses: z.array(z.object({
    code: z.string().trim().min(2).max(40),
    nameTh: nullableText,
    nameEn: nullableText,
    credits: z.number().positive().max(99).nullable().default(null),
    prerequisiteCodes: z.array(z.string().trim().min(2).max(40)).max(50).default([]),
    requirementGroupIds: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  })).max(1000).default([]),
  completedCourses: z.array(z.object({
    code: z.string().trim().min(2).max(40),
    name: z.string().trim().min(1).max(250),
    credits: z.number().positive().max(99),
    grade: gradeSchema.nullable().default(null),
    term: z.string().trim().max(80).nullable().default(null),
    academicYear: z.number().int().min(1900).max(3000).nullable().default(null),
  })).max(1000).default([]),
  unresolvedCourses: z.array(z.object({
    sourceText: z.string().trim().min(1).max(1000),
    reason: z.string().trim().min(1).max(250),
    suggestedName: nullableText,
  })).max(500).default([]),
  evidence: z.array(z.object({
    path: z.string().trim().min(1).max(500),
    sourceDocumentId: z.string().uuid(),
    page: z.number().int().positive().max(10000).nullable().default(null),
    text: z.string().trim().min(1).max(1000),
    confidence: z.number().min(0).max(1),
  })).max(5000).default([]),
  warnings: z.array(z.string().trim().min(1).max(500)).max(500).default([]),
  sources: z.array(z.object({
    sourceDocumentId: z.string().uuid(),
    detectedKind: sourceKindSchema,
  })).max(100).default([]),
});
export type AcademicProfileExtraction = z.infer<typeof academicProfileExtractionSchema>;
export type AcademicSourceKind = z.infer<typeof sourceKindSchema>;

export function normalizedCourseCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
