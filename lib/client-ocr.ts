"use client";
import { parseTranscript } from "@/lib/parser";
export type OcrResult = { text: string; confidence: number; courses: ReturnType<typeof parseTranscript> };
/** Local-first OCR provider. It does not upload document bytes to an OCR vendor. */
export async function extractLocally(file: File): Promise<OcrResult> {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) text += "\n" + (await (await document.getPage(pageNumber)).getTextContent()).items.map((item: unknown) => "str" in (item as object) ? String((item as { str: string }).str) : "").join(" ");
    return { text, confidence: text.trim() ? .72 : .1, courses: parseTranscript(text) };
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("tha+eng");
  try { const result = await worker.recognize(file); return { text: result.data.text, confidence: result.data.confidence / 100, courses: parseTranscript(result.data.text) }; } finally { await worker.terminate(); }
}
