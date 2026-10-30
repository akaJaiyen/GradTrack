import { afterEach, describe, expect, it, vi } from "vitest";
import { extractTyphoonProfile, typhoonOcrPages, TyphoonRequestError } from "@/lib/typhoon";

const sourceDocumentId = "33333333-3333-4333-8333-333333333333";
const validExtraction = {
  profile: { institution: "Example", program: null, degreeLevel: "unknown", curriculumYear: null, languages: ["th"], status: "ready" },
  curriculum: { totalCreditsRequired: null, requirementGroups: [], requiredCourses: [] },
  catalogCourses: [], completedCourses: [], unresolvedCourses: [], evidence: [], warnings: [],
  sources: [{ detectedKind: "transcript" }],
};
const response = (content: string, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Typhoon document pipeline adapter", () => {
  it("sends each page as a base64 image data URL and returns Markdown in page order", async () => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValueOnce(response("# Page one")).mockResolvedValueOnce(response("| Page | Two |"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(typhoonOcrPages(["cGFnZTE=", "cGFnZTI="])).resolves.toContain("# Page one\n\n--- Page 2 ---\n| Page | Two |");
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(firstBody.model).toBe("typhoon-ocr");
    expect(firstBody.messages[0].content[1].image_url.url).toBe("data:image/png;base64,cGFnZTE=");
  });

  it("uses the text model and validates its JSON output", async () => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(response(JSON.stringify(validExtraction)));
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractTyphoonProfile({ text: "Transcript OCR", sourceDocumentId, sourceRole: "transcript" });
    expect(result.profile.institution).toBe("Example");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("typhoon-v2.5-30b-a3b-instruct");
  });

  it("rejects malformed JSON and incomplete required structure safely", async () => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("not json")));
    await expect(extractTyphoonProfile({ text: "OCR", sourceDocumentId, sourceRole: "study_plan" })).rejects.toMatchObject({ stage: "typhoon_text" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(JSON.stringify({ completedCourses: [{ code: "", name: "", credits: -1 }] }))));
    const normalized = await extractTyphoonProfile({ text: "OCR", sourceDocumentId, sourceRole: "study_plan" });
    expect(normalized.completedCourses).toEqual([]);
  });

  it.each([401, 403, 429, 503])("maps provider HTTP %s to a safe stage error", async status => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("provider detail must not leak", { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(typhoonOcrPages(["image"])).rejects.toBeInstanceOf(TyphoonRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(status === 503 ? 3 : 1);
    if (status === 503) await expect(typhoonOcrPages(["image"])).rejects.toMatchObject({ failureKind: "provider_http" });
  });

  it("marks network failures separately from HTTP failures without exposing request data", async () => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket error")));
    await expect(typhoonOcrPages(["image"])).rejects.toMatchObject({ status: 502, failureKind: "network" });
  });

  it("merges results when OCR text is split into chunks", async () => {
    vi.stubEnv("TYPHOON_API_KEY", "test-key");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response(JSON.stringify(validExtraction))));
    vi.stubGlobal("fetch", fetchMock);
    await extractTyphoonProfile({ text: `${"First paragraph.\n\n".repeat(600)}${"Second paragraph.\n\n".repeat(600)}`, sourceDocumentId, sourceRole: "transcript" });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
