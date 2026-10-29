"use client";
import { parseTranscript } from "@/lib/parser";
export type OcrResult = { text: string; confidence: number; courses: ReturnType<typeof parseTranscript> };
/** PDF.js can expose one printed number as adjacent text items (for example, `1`, `5`). */
export function joinPdfTextItems(items: unknown[]) {
  const text: string[] = [];
  for (const item of items) {
    if (!("str" in (item as object))) continue;
    const value = String((item as { str: string }).str).trim();
    if (!value) continue;
    const previous = text.at(-1);
    // Join only short fragments such as `1`, `5` -> `15`; never attach a
    // one-credit value to the next eight-digit course code.
    if (previous && /^\d+$/.test(previous) && /^\d+$/.test(value) && previous.length + value.length <= 3) text[text.length - 1] += value;
    else text.push(value);
  }
  return text.join(" ");
}
/** Local-first OCR provider. It does not upload document bytes to an OCR vendor. */
export async function extractLocally(file: File): Promise<OcrResult> {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    // Next bundles the worker separately; without this, PDF.js often fails only in the browser.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) text += "\n" + joinPdfTextItems((await (await document.getPage(pageNumber)).getTextContent()).items);
    return { text, confidence: text.trim() ? .72 : .1, courses: parseTranscript(text) };
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("tha+eng");
  try { const result = await worker.recognize(file); return { text: result.data.text, confidence: result.data.confidence / 100, courses: parseTranscript(result.data.text) }; } finally { await worker.terminate(); }
}
