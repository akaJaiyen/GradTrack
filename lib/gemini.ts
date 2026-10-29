import { academicProfileExtractionSchema, type AcademicProfileExtraction } from "@/lib/extraction";

// Gemini 2.5 Flash is unavailable to new users. Flash-Lite is the reliable
// low-cost multimodal default; deployments can still override it explicitly.
const configuredModel = () => process.env.GEMINI_MODEL;
const modelCandidates = () => [...new Set([configuredModel(), "gemini-3.5-flash-lite", "gemini-3.6-flash"].filter(Boolean) as string[])];
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

class GeminiRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

const instruction = `You extract academic records from ONE uploaded document. Return JSON only. Never infer or invent missing facts. Use [] or null for absent values. Extract curriculum credit groups, catalog courses, completed transcript courses, unresolved course rows, and warnings when present. Preserve Thai and English names. Course codes that are unclear must go into unresolvedCourses, never catalogCourses or completedCourses.

Use exactly this camelCase shape (all top-level keys are required):
{"profile":{"institution":null,"program":null,"degreeLevel":"unknown","curriculumYear":null,"languages":[],"status":"ready"},"curriculum":{"totalCreditsRequired":null,"requirementGroups":[]},"catalogCourses":[],"completedCourses":[],"unresolvedCourses":[],"evidence":[],"warnings":[],"sources":[{"sourceDocumentId":"SOURCE_ID","detectedKind":"unknown"}]}
Each requirementGroups row: {"id":"short-id","parentId":null,"name":"...","kind":"total|container|required_bucket|elective_bucket|credit_bucket","minimumCredits":null,"requiredCourseCodes":[]}.
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
  const mapCatalog = (course: any) => ({ code: course.code ?? course.courseCode ?? course.course_code, nameTh: course.nameTh ?? course.name_th ?? null, nameEn: course.nameEn ?? course.name_en ?? course.name ?? null, credits: course.credits ?? null, prerequisiteCodes: course.prerequisiteCodes ?? course.prerequisite_codes ?? [], requirementGroupIds: course.requirementGroupIds ?? course.requirement_group_ids ?? [] });
  const mapCompleted = (course: any) => ({ code: course.code ?? course.courseCode ?? course.course_code, name: course.name ?? course.nameTh ?? course.name_th ?? course.nameEn ?? course.name_en, credits: course.credits, grade: grade(course.grade), term: course.term ?? null, academicYear: course.academicYear ?? course.academic_year ?? null });
  const evidence = Array.isArray(value.evidence) ? value.evidence.map((item: any) => ({ path: item.path ?? item.field ?? "unknown", sourceDocumentId, page: item.page ?? null, text: item.text ?? item.quote ?? item.excerpt ?? "No excerpt provided", confidence: Number(item.confidence ?? 0.5) })) : [];
  return academicProfileExtractionSchema.safeParse({
    profile: { institution: profile.institution ?? profile.university ?? value.institution ?? value.university ?? null, program: profile.program ?? profile.program_name ?? value.program ?? value.program_name ?? null, degreeLevel, curriculumYear: profile.curriculumYear ?? profile.curriculum_year ?? value.curriculumYear ?? value.curriculum_year ?? null, languages: profile.languages ?? value.languages ?? [], status: profile.status === "ready_with_warnings" ? "ready_with_warnings" : "ready" },
    curriculum: { totalCreditsRequired: curriculum.totalCreditsRequired ?? curriculum.total_credits_required ?? null, requirementGroups: groups.map(mapGroup) },
    catalogCourses: (Array.isArray(value.catalogCourses ?? value.catalog_courses) ? value.catalogCourses ?? value.catalog_courses : []).map(mapCatalog),
    completedCourses: (Array.isArray(value.completedCourses ?? value.completed_courses) ? value.completedCourses ?? value.completed_courses : []).map(mapCompleted),
    unresolvedCourses: Array.isArray(value.unresolvedCourses ?? value.unresolved_courses) ? value.unresolvedCourses ?? value.unresolved_courses : [],
    evidence,
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
    sources: [{ sourceDocumentId, detectedKind: detectedKind(value.sources?.[0]?.detectedKind ?? value.detectedKind ?? value.detected_kind) }],
  });
}

export async function extractWithGemini(input: { bytes: Uint8Array; mimeType: string; sourceDocumentId: string }): Promise<AcademicProfileExtraction> {
  if (!process.env.GEMINI_API_KEY) throw new Error("Gemini is not configured. Add GEMINI_API_KEY on the server.");
  const request = async (model: string, repair = false) => {
    const response = await fetch(endpoint(model), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `${instruction}\nSource document ID: ${input.sourceDocumentId}.${repair ? " Your previous response was invalid. Return a schema-valid JSON object only." : ""}` },
          { inlineData: { mimeType: input.mimeType, data: Buffer.from(input.bytes).toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new GeminiRequestError(`Gemini request failed (${response.status})${failure?.error?.message ? `: ${failure.error.message}` : ""}`, response.status === 429 || response.status >= 500);
    }
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
    if (!text) throw new Error("Gemini returned no extraction");
    return normalizeGeminiAcademicPayload(JSON.parse(text), input.sourceDocumentId);
  };
  let lastError: Error = new Error("Gemini returned an invalid academic profile");
  for (const model of modelCandidates()) {
    try {
      const first = await request(model);
      if (first.success) return first.data;
      const repaired = await request(model, true);
      if (repaired.success) return repaired.data;
      lastError = new Error("Gemini returned an invalid academic profile");
    } catch (caught) {
      lastError = caught instanceof Error ? caught : lastError;
      if (!(caught instanceof GeminiRequestError) || !caught.retryable) continue;
      // A short pause prevents immediately repeating a capacity-limited call.
      await new Promise(resolve => setTimeout(resolve, 700));
    }
  }
  throw lastError;
}
