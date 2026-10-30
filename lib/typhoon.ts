import { normalizeAcademicPayload } from "@/lib/academic-payload";
import type { AcademicProfileExtraction } from "@/lib/extraction";

const baseUrl = "https://api.opentyphoon.ai/v1";
const requestDelayMs = process.env.NODE_ENV === "test" ? 0 : 3_100;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let previousOcrRequestAt = 0;
let ocrRequestQueue = Promise.resolve();

async function runOcrRequest<T>(request: () => Promise<T>): Promise<T> {
  const previous = ocrRequestQueue;
  let release!: () => void;
  ocrRequestQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const wait = requestDelayMs - (Date.now() - previousOcrRequestAt);
    if (previousOcrRequestAt && wait > 0) await pause(wait);
    previousOcrRequestAt = Date.now();
    return await request();
  } finally {
    release();
  }
}

export type TyphoonStage = "typhoon_ocr" | "typhoon_text";
export type TyphoonFailureKind = "configuration" | "network" | "provider_http" | "invalid_response" | "model_response";
export class TyphoonRequestError extends Error {
  constructor(message: string, readonly status: number, readonly stage: TyphoonStage, readonly failureKind: TyphoonFailureKind) { super(message); }
}
export const isTyphoonRateLimited = (error: unknown) => error instanceof TyphoonRequestError && error.status === 429;

async function callTyphoon(model: string, messages: unknown[], stage: TyphoonStage, maxTokens: number) {
  const key = process.env.TYPHOON_API_KEY;
  if (!key) throw new TyphoonRequestError("Typhoon API key is not configured", 0, stage, "configuration");
  let last: Error = new Error("Typhoon request failed");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1, stream: false }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      last = new TyphoonRequestError("Typhoon request failed", 502, stage, "network");
      if (attempt === 2) throw last;
      await pause(process.env.NODE_ENV === "test" ? 0 : Math.max(stage === "typhoon_ocr" ? requestDelayMs : 0, 500 * 2 ** attempt));
      continue;
    }
    if (response.ok) {
      let payload: { choices?: Array<{ message?: { content?: unknown } }> };
      try { payload = await response.json() as typeof payload; }
      catch { throw new TyphoonRequestError("Typhoon returned an invalid response", 502, stage, "invalid_response"); }
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new TyphoonRequestError("Typhoon returned empty content", 502, stage, "invalid_response");
      return content;
    }
    last = new TyphoonRequestError(`Typhoon request failed (${response.status})`, response.status, stage, "provider_http");
    if (response.status === 429 || response.status < 500 || attempt === 2) throw last;
    await pause(process.env.NODE_ENV === "test" ? 0 : Math.max(stage === "typhoon_ocr" ? requestDelayMs : 0, 500 * 2 ** attempt));
  }
  throw last;
}

export async function renderPdfPages(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1800 / Math.max(base.width, base.height), 2);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d") as never, viewport }).promise;
    pages.push(canvas.toBuffer("image/png").toString("base64"));
  }
  return pages;
}

export async function typhoonOcrPages(pages: string[]) {
  const model = process.env.TYPHOON_OCR_MODEL || "typhoon-ocr";
  const output: string[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const text = await runOcrRequest(() => callTyphoon(model, [{ role: "user", content: [
      { type: "text", text: "อ่านข้อความภาษาไทยและอังกฤษจากเอกสารนี้ รักษาหัวข้อ ลำดับ และตารางเป็น Markdown ห้ามสรุปหรือเดาข้อมูล" },
      { type: "image_url", image_url: { url: `data:image/png;base64,${pages[index]}` } },
    ] }], "typhoon_ocr", 8_192));
    output.push(`\n\n--- Page ${index + 1} ---\n${text}`);
  }
  return output.join("").trim();
}

const extractionInstruction = `Extract academic information from the provided OCR Markdown. Return one JSON object only, never invent facts. Preserve Thai and English. For study plans, use only stated totals and put named required courses in curriculum.requiredCourses; do not invent codes or treat generic electives as required courses. For transcripts, extract completed rows only. Use exactly this shape:
{"profile":{"institution":null,"program":null,"degreeLevel":"unknown","curriculumYear":null,"languages":[],"status":"ready"},"curriculum":{"totalCreditsRequired":null,"requirementGroups":[],"requiredCourses":[]},"catalogCourses":[],"completedCourses":[],"unresolvedCourses":[],"evidence":[],"warnings":[],"sources":[{"detectedKind":"unknown"}]}
Each requirementGroups row: {"id":"short-id","parentId":null,"name":"...","kind":"total|container|required_bucket|elective_bucket|credit_bucket","minimumCredits":null,"requiredCourseCodes":[]}. Each requiredCourses row: {"id":"stable-id","groupId":null,"code":null,"nameTh":null,"nameEn":null,"credits":null,"evidencePath":"curriculum.requiredCourses.0"}. Catalog rows use {"code":"...","nameTh":null,"nameEn":null,"credits":null,"prerequisiteCodes":[],"requirementGroupIds":[]}. Completed rows use {"code":"...","name":"...","credits":3,"grade":null,"term":null,"academicYear":null}. For completed rows, term must be exactly "1", "2", "3", "summer", or null; put a numeric year only in academicYear and never embed it in term. Evidence uses {"path":"...","page":null,"text":"excerpt","confidence":0.9}.`;

function chunks(text: string, limit = 3_000) {
  const paragraphs = text.split(/\n\s*\n/);
  const result: string[] = [];
  let chunk = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > limit) {
      if (chunk) result.push(chunk), chunk = "";
      for (let i = 0; i < paragraph.length; i += limit) result.push(paragraph.slice(i, i + limit));
    } else if (chunk.length + paragraph.length + 2 > limit) {
      result.push(chunk); chunk = paragraph;
    } else chunk += `${chunk ? "\n\n" : ""}${paragraph}`;
  }
  if (chunk) result.push(chunk);
  return result.length ? result : [text];
}

export async function extractTyphoonProfile(input: { text: string; sourceDocumentId: string; sourceRole: "study_plan" | "transcript" | "academic_source" }): Promise<AcademicProfileExtraction> {
  const model = process.env.TYPHOON_TEXT_MODEL || "typhoon-v2.5-30b-a3b-instruct";
  const parts = chunks(input.text);
  const outputs: AcademicProfileExtraction[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const prompt = `${extractionInstruction}\nSource document ID: ${input.sourceDocumentId}. Role: ${input.sourceRole}. Part ${i + 1}/${parts.length}.`;
    const raw = await callTyphoon(model, [{ role: "system", content: "You extract structured academic records. Return valid JSON only." }, { role: "user", content: `${prompt}\n\nOCR Markdown:\n${parts[i]}` }], "typhoon_text", 4_096);
    let parsed: unknown;
    try { parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
    catch { throw new TyphoonRequestError("Typhoon text response was not valid JSON", 502, "typhoon_text", "model_response"); }
    const result = normalizeAcademicPayload(parsed, input.sourceDocumentId);
    if (!result.success) throw new TyphoonRequestError("Typhoon text response did not match the academic schema", 502, "typhoon_text", "model_response");
    outputs.push(result.data);
  }
  if (outputs.length === 1) return outputs[0];
  const merged = normalizeAcademicPayload({
    profile: outputs[0].profile,
    curriculum: { totalCreditsRequired: outputs.find(x => x.curriculum.totalCreditsRequired)?.curriculum.totalCreditsRequired ?? null, requirementGroups: outputs.flatMap(x => x.curriculum.requirementGroups), requiredCourses: outputs.flatMap(x => x.curriculum.requiredCourses) },
    catalogCourses: outputs.flatMap(x => x.catalogCourses), completedCourses: outputs.flatMap(x => x.completedCourses),
    unresolvedCourses: outputs.flatMap(x => x.unresolvedCourses), evidence: outputs.flatMap(x => x.evidence), warnings: outputs.flatMap(x => x.warnings), detectedKind: outputs[0].sources[0]?.detectedKind,
  }, input.sourceDocumentId);
  if (!merged.success) throw new TyphoonRequestError("Typhoon merged output did not match the academic schema", 502, "typhoon_text", "model_response");
  return merged.data;
}
