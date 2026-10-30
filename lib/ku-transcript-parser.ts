import { normalizedCourseCode } from "@/lib/extraction";
import { type AcademicTerm } from "@/lib/academic-term";
import type { Grade } from "@/lib/types";

export type TranscriptEvidence = { page: number; rowText: string; termHeader: string };
export type TranscriptDraft = {
  code: string; name: string; credits: number; grade: Grade | null;
  term: AcademicTerm | null; academicYear: number | null; evidence: TranscriptEvidence;
  status: "ready" | "needs_review"; parser: "ku_pdf" | "ai";
};
type PositionedText = { str: string; x: number; y: number };
type PdfPage = { page: number; width: number; items: PositionedText[] };

const gradePattern = /(?:^|\s)(A|B\+|B|C\+|C|D\+|D|F|P|S|W|I|N)\s+([1-9](?:\.\d)?)(?:\*)?(?:\s|$)/;
const headingPattern = /^(First|Second|Third) Semester\s+(19\d{2}|2\d{3})$/i;
const summerPattern = /^Summer Session\s+(19\d{2}|2\d{3})$/i;
const coursePattern = /^(\d{8})\s+(.+)$/;

function termFromHeading(value: string): { term: AcademicTerm; year: number } | null {
  const regular = value.match(headingPattern);
  if (regular) return { term: ({ First: "1", Second: "2", Third: "3" } as Record<string, AcademicTerm>)[regular[1][0].toUpperCase() + regular[1].slice(1).toLowerCase()], year: Number(regular[2]) };
  const summer = value.match(summerPattern);
  return summer ? { term: "summer", year: Number(summer[1]) } : null;
}

function linesForColumn(items: PositionedText[], page: number, column: "left" | "right", midpoint: number) {
  const selected = items.filter(item => item.str.trim() && (column === "left" ? item.x < midpoint : item.x >= midpoint));
  const lines: Array<{ y: number; parts: PositionedText[] }> = [];
  for (const item of selected) {
    const existing = lines.find(line => Math.abs(line.y - item.y) < 2.5);
    if (existing) existing.parts.push(item); else lines.push({ y: item.y, parts: [item] });
  }
  return lines.sort((a, b) => b.y - a.y).map(line => ({ page, text: line.parts.sort((a, b) => a.x - b.x).map(item => item.str.trim()).join(" ").replace(/\s+/g, " ").trim() }));
}

/** Parses the selectable-text, two-column KU transcript layout. It intentionally
 * returns no rows for unfamiliar layouts so callers can use the safer AI fallback. */
export function parseKuTranscriptPages(pages: PdfPage[]): TranscriptDraft[] {
  const result: TranscriptDraft[] = [];
  let active: { term: AcademicTerm; year: number; header: string } | null = null;
  for (const page of pages) {
    for (const column of ["left", "right"] as const) {
      const lines = linesForColumn(page.items, page.page, column, page.width / 2);
      let current: { text: string; page: number; context: typeof active } | null = null;
      const flush = () => {
        if (!current) return;
        const match = current.text.match(coursePattern);
        const resultMatch = current.text.match(gradePattern);
        if (match && resultMatch) {
          const nameEnd = Math.max(0, (resultMatch.index ?? 0) - match[1].length - 1);
          const name = match[2].slice(0, nameEnd).trim();
          const credits = Number(resultMatch[2]);
          const context = current.context;
          result.push({ code: normalizedCourseCode(match[1]), name, credits, grade: resultMatch[1] as Grade, term: context?.term ?? null, academicYear: context?.year ?? null, evidence: { page: current.page, rowText: current.text, termHeader: context?.header ?? "" }, status: context && name ? "ready" : "needs_review", parser: "ku_pdf" });
        }
        current = null;
      };
      for (const line of lines) {
        const heading = termFromHeading(line.text);
        if (heading) { flush(); active = { ...heading, header: line.text }; continue; }
        if (/^(sem\. G\.P\.A\.|cum\. G\.P\.A\.|cum\. CR\.|Nothing follows)/i.test(line.text)) { flush(); continue; }
        if (coursePattern.test(line.text)) { flush(); current = { text: line.text, page: line.page, context: active }; }
        else if (current && !/^(COURSE|CODE|GR|CR|Explanation:|[123]\.)/i.test(line.text)) {
          // PDF text places wrapped title lines below the grade/credit columns.
          // Keep that continuation in the course title instead of appending it
          // after the result fields.
          const result = current.text.match(gradePattern);
          current.text = result?.index === undefined
            ? `${current.text} ${line.text}`
            : `${current.text.slice(0, result.index).trimEnd()} ${line.text} ${current.text.slice(result.index)}`;
        }
      }
      flush();
    }
  }
  return result.filter(row => row.name && Number.isFinite(row.credits) && row.credits > 0);
}

export async function parseKuTranscriptPdf(bytes: Uint8Array): Promise<{ pageCount: number; drafts: TranscriptDraft[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: PdfPage[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({ page: pageNo, width: viewport.width, items: content.items.flatMap(item => {
      const text = item as { str?: unknown; transform?: unknown };
      const transform = Array.isArray(text.transform) ? text.transform : [];
      return typeof text.str === "string" && typeof transform[4] === "number" && typeof transform[5] === "number" ? [{ str: text.str, x: transform[4], y: transform[5] }] : [];
    }) });
  }
  return { pageCount: pdf.numPages, drafts: parseKuTranscriptPages(pages) };
}

export function passesTranscriptAcceptanceGate(drafts: TranscriptDraft[], pageCount: number) {
  if (!drafts.length) return { ok: false, reason: "ไม่พบแถวรายวิชาที่ตรวจสอบได้จาก Transcript" } as const;
  const invalid = drafts.find(draft => !draft.term || !draft.academicYear || draft.evidence.page < 1 || draft.evidence.page > pageCount || !draft.evidence.termHeader || !draft.evidence.rowText.includes(draft.code) || !draft.evidence.rowText.includes(String(draft.credits)) || (draft.grade && !new RegExp(`(?:^|\\s)${draft.grade.replace("+", "\\+")}(?:\\s|$)`).test(draft.evidence.rowText)));
  return invalid ? { ok: false, reason: "พบรายวิชาที่ไม่มีหลักฐานเทอม ปี หรือข้อมูลแถวที่ตรวจสอบได้" } as const : { ok: true } as const;
}
