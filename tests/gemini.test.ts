import { afterEach, describe, expect, it, vi } from "vitest";
import { extractWithGemini, normalizeGeminiAcademicPayload } from "@/lib/gemini";

const sourceDocumentId = "33333333-3333-4333-8333-333333333333";
const validExtraction = JSON.stringify({
  profile: { institution: "Example", program: null, degreeLevel: "unknown", curriculumYear: null, languages: ["th"], status: "ready" },
  curriculum: { totalCreditsRequired: null, requirementGroups: [] }, catalogCourses: [], completedCourses: [], unresolvedCourses: [], evidence: [], warnings: [],
  sources: [{ sourceDocumentId, detectedKind: "curriculum" }],
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Gemini academic extraction adapter", () => {
  it("normalizes a partial snake_case response before validating it", () => {
    const result = normalizeGeminiAcademicPayload({
      university: "Example University", curriculum: { total_credits_required: 120 },
      catalog_courses: [{ course_code: "CS 101", name_th: "การเขียนโปรแกรม", credits: 3 }],
      detected_kind: "course_catalog",
    }, sourceDocumentId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profile.institution).toBe("Example University");
      expect(result.data.catalogCourses[0].code).toBe("CS 101");
      expect(result.data.sources[0].detectedKind).toBe("catalog");
    }
  });

  it("preserves a named study-plan requirement when its course code is absent", () => {
    const result = normalizeGeminiAcademicPayload({
      curriculum: { total_credits_required: 121, required_courses: [{ id: "term-1-language", name_th: "ภาษาต่างประเทศ 1", credits: 3 }] },
      detected_kind: "curriculum",
    }, sourceDocumentId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.curriculum.totalCreditsRequired).toBe(121);
      expect(result.data.curriculum.requiredCourses[0]).toMatchObject({ code: null, nameTh: "ภาษาต่างประเทศ 1", credits: 3 });
    }
  });

  it("validates a structured Gemini response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: validExtraction }] } }] }), { status: 200 })));
    const result = await extractWithGemini({ bytes: new Uint8Array([1, 2]), mimeType: "application/pdf", sourceDocumentId });
    expect(result.profile.institution).toBe("Example");
  });

  it("sends local text instead of document bytes when available", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: validExtraction }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await extractWithGemini({ text: "--- Page 1 ---\nCourse details", sourceDocumentId });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("Course details") })]));
    expect(body.contents[0].parts.some((part: { inlineData?: unknown }) => part.inlineData)).toBe(false);
  });

  it("retries once when Gemini returns malformed JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: validExtraction }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(extractWithGemini({ bytes: new Uint8Array([1]), mimeType: "application/pdf", sourceDocumentId })).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a provider failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(extractWithGemini({ bytes: new Uint8Array([1]), mimeType: "application/pdf", sourceDocumentId })).rejects.toThrow("Gemini request failed");
  });

  it("does not retry a rate-limited Gemini request", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(extractWithGemini({ bytes: new Uint8Array([1]), mimeType: "application/pdf", sourceDocumentId })).rejects.toThrow("Gemini request failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
