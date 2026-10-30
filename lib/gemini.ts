import { academicProfileExtractionSchema, type AcademicProfileExtraction } from "@/lib/extraction";

// Deployments may override the primary model. Use one model for each queued
// extraction so a rate-limited fallback cannot consume another model's quota.
const configuredModel = () => process.env.GEMINI_MODEL;
const modelCandidates = () => [configuredModel() || "gemini-3.5-flash-lite"];
const retryDelaysMs = process.env.NODE_ENV === "test" ? [0] : [2_000];
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

export class GeminiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly rateLimited: boolean) { super(message); }
}

export function isGeminiRateLimitError(error: unknown) {
  return error instanceof GeminiRequestError && error.rateLimited;
}

const instruction = `You extract academic records from ONE uploaded document. Return JSON only. Never infer or invent missing facts. Use [] or null for absent values. Extract curriculum credit groups, required courses, catalog courses, completed transcript courses, unresolved course rows, and warnings when present. Preserve Thai and English names.

For a STUDY PLAN: use only totals stated in that document (including labelled semester totals when they add to a curriculum total); never use a fixed programme credit value. Put every explicitly named required course in curriculum.requiredCourses, even if it has no code: use code:null in that case. Do not invent a code. Do not turn generic choices such as electives, language slots, or a wildcard code (for example xxxx) into required courses; preserve their stated credits as a group or add a warning when their eligibility cannot be determined. For a TRANSCRIPT: put completed rows only in completedCourses.

Use exactly this camelCase shape (all top-level keys are required):
{"profile":{"institution":null,"program":null,"degreeLevel":"unknown","curriculumYear":null,"languages":[],"status":"ready"},"curriculum":{"totalCreditsRequired":null,"requirementGroups":[],"requiredCourses":[]},"catalogCourses":[],"completedCourses":[],"unresolvedCourses":[],"evidence":[],"warnings":[],"sources":[{"sourceDocumentId":"SOURCE_ID","detectedKind":"unknown"}]}
Each requirementGroups row: {"id":"short-id","parentId":null,"name":"...","kind":"total|container|required_bucket|elective_bucket|credit_bucket","minimumCredits":null,"requiredCourseCodes":[]}.
Each curriculum.requiredCourses row: {"id":"stable-short-id","groupId":null,"code":null,"nameTh":null,"nameEn":null,"credits":null,"evidencePath":"curriculum.requiredCourses.0"}. A row needs a course code or at least one name.
Each catalogCourses row: {"code":"...","nameTh":null,"nameEn":null,"credits":null,"prerequisiteCodes":[],"requirementGroupIds":[]}.
Each completedCourses row: {"code":"...","name":"...","credits":3,"grade":null,"term":null,"academicYear":null}.
Each evidence row: {"path":"...","sourceDocumentId":"SOURCE_ID","page":null,"text":"exact excerpt","confidence":0.0}.`;

/** Accept harmless snake_case aliases from model output, then validate one canonical shape. */
export function normalizeGeminiAcademicPayload(raw: unknown, sourceDocumentId: string) {
  const value = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  const profile = value.profile && typeof value.profile === "object" ? value.profile : {};
  const curriculum = value.curriculum && typeof value.curriculum === "object" ? value.curriculum : {};
  const groups = Array.isArray(curriculum.requirementGroups ?? curriculum.requirement_groups) ? (curriculum.requirementGroups ?? curriculum.requirement_groups) : [];
  const kind = (value: unknown) => ({ required: "required_bucket", elective: "elective_bucket", credit: "credit_bucket" } as Record<string, string>)[String(value)] || value || "credit_bucket";
  const degreeLevel = ["bachelor", "master", "doctorate", "certificate"].includes(String(profile.degreeLevel ?? profile.degree_level)) ? profile.degreeLevel ?? profile.degree_level : "unknown";
  const grade = (value: unknown) => ["A", "B+", "B", "C+", "C", "D+", "D", "F", "P", "S", "W", "I", "N"].includes(String(value)) ? value : null;
  const detectedKind = (value: unknown) => ({ curriculum_summary: "curriculum", course_catalog: "catalog", course: "catalog" } as Record<string, string>)[String(value)] || value || "unknown";
  const mapGroup = (group: any) => ({ id: String(group.id ?? group.name ?? "unclassified").slice(0, 100), parentId: group.parentId ?? group.parent_id ?? null, name: group.name ?? "Unclassified", kind: kind(group.kind), minimumCredits: group.minimumCredits ?? group.minimum_credits ?? null, requiredCourseCodes: group.requiredCourseCodes ?? group.required_course_codes ?? [] });
  const rawRequiredCourses = Array.isArray(curriculum.requiredCourses ?? curriculum.required_courses) ? curriculum.requiredCourses ?? curriculum.required_courses : [];
  const mapRequired = (course: any, index: number) => ({
    id: String(course.id ?? `required-${index + 1}`).slice(0, 160),
    groupId: course.groupId ?? course.group_id ?? null,
    code: course.code ?? course.courseCode ?? course.course_code ?? null,
    nameTh: course.nameTh ?? course.name_th ?? null,
    nameEn: course.nameEn ?? course.name_en ?? course.name ?? null,
    credits: course.credits ?? null,
    evidencePath: course.evidencePath ?? course.evidence_path ?? `curriculum.requiredCourses.${index}`,
  });
  const mapCatalog = (course: any) => ({ code: course.code ?? course.courseCode ?? course.course_code, nameTh: course.nameTh ?? course.name_th ?? null, nameEn: course.nameEn ?? course.name_en ?? course.name ?? null, credits: course.credits ?? null, prerequisiteCodes: course.prerequisiteCodes ?? course.prerequisite_codes ?? [], requirementGroupIds: course.requirementGroupIds ?? course.requirement_group_ids ?? [] });
  const mapCompleted = (course: any) => ({ code: course.code ?? course.courseCode ?? course.course_code, name: course.name ?? course.nameTh ?? course.name_th ?? course.nameEn ?? course.name_en, credits: course.credits, grade: grade(course.grade), term: course.term ?? null, academicYear: course.academicYear ?? course.academic_year ?? null });
  const evidence = Array.isArray(value.evidence) ? value.evidence.map((item: any) => ({ path: item.path ?? item.field ?? "unknown", sourceDocumentId, page: item.page ?? null, text: item.text ?? item.quote ?? item.excerpt ?? "No excerpt provided", confidence: Number(item.confidence ?? 0.5) })) : [];
  return academicProfileExtractionSchema.safeParse({
    profile: { institution: profile.institution ?? profile.university ?? value.institution ?? value.university ?? null, program: profile.program ?? profile.program_name ?? value.program ?? value.program_name ?? null, degreeLevel, curriculumYear: profile.curriculumYear ?? profile.curriculum_year ?? value.curriculumYear ?? value.curriculum_year ?? null, languages: profile.languages ?? value.languages ?? [], status: profile.status === "ready_with_warnings" ? "ready_with_warnings" : "ready" },
    curriculum: { totalCreditsRequired: curriculum.totalCreditsRequired ?? curriculum.total_credits_required ?? null, requirementGroups: groups.map(mapGroup), requiredCourses: rawRequiredCourses.map(mapRequired) },
    catalogCourses: (Array.isArray(value.catalogCourses ?? value.catalog_courses) ? value.catalogCourses ?? value.catalog_courses : []).map(mapCatalog),
    completedCourses: (Array.isArray(value.completedCourses ?? value.completed_courses) ? value.completedCourses ?? value.completed_courses : []).map(mapCompleted),
    unresolvedCourses: Array.isArray(value.unresolvedCourses ?? value.unresolved_courses) ? value.unresolvedCourses ?? value.unresolved_courses : [],
    evidence,
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
    sources: [{ sourceDocumentId, detectedKind: detectedKind(value.sources?.[0]?.detectedKind ?? value.detectedKind ?? value.detected_kind) }],
  });
}

type GeminiExtractionInput = {
  sourceDocumentId: string;
  sourceRole?: "study_plan" | "transcript" | "academic_source";
} & ({ text: string } | { bytes: Uint8Array; mimeType: string });

export async function extractWithGemini(input: GeminiExtractionInput): Promise<AcademicProfileExtraction> {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini is not configured. Add GEMINI_API_KEY on the server.");
  const request = async (model: string, repair = false) => {
    const response = await fetch(endpoint(model), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `${instruction}\nSource document ID: ${input.sourceDocumentId}. Declared document role: ${input.sourceRole || "academic_source"}.${repair ? " Your previous response was invalid. Return a schema-valid JSON object only." : ""}` },
          ...("text" in input
            ? [{ text: `Extract only from this locally extracted document text:\n${input.text}` }]
            : [{ inlineData: { mimeType: input.mimeType, data: Buffer.from(input.bytes).toString("base64") } }]),
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { message?: string; status?: string } } | null;
      const detail = `${failure?.error?.status || ""} ${failure?.error?.message || ""}`;
      const rateLimited = response.status === 429 || /resource_exhausted|rate.?limit|quota/i.test(detail);
      throw new GeminiRequestError(`Gemini request failed (${response.status})${failure?.error?.message ? `: ${failure.error.message}` : ""}`, response.status, rateLimited);
    }
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
    if (!text) throw new Error("Gemini returned no extraction");
    try {
      return normalizeGeminiAcademicPayload(JSON.parse(text), input.sourceDocumentId);
    } catch {
      return normalizeGeminiAcademicPayload({ completedCourses: [{ code: "", name: "", credits: 0 }] }, input.sourceDocumentId);
    }
  };
  let lastError: Error = new Error("Gemini returned an invalid academic profile");
  for (const model of modelCandidates()) {
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const first = await request(model);
        if (first.success) return first.data;
        const repaired = await request(model, true);
        if (repaired.success) return repaired.data;
        lastError = new Error("Gemini returned an invalid academic profile");
        break;
      } catch (caught) {
        lastError = caught instanceof Error ? caught : lastError;
        if (!(caught instanceof GeminiRequestError) || caught.rateLimited || caught.status < 500 || attempt === retryDelaysMs.length) break;
        await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt]));
      }
    }
  }
  throw lastError;
}
