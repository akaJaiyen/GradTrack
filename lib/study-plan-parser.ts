import { academicProfileExtractionSchema, normalizedCourseCode, type AcademicProfileExtraction } from "@/lib/extraction";

type ParsedCourse = { code: string; nameTh: string; credits: number; page: number; groupId: string; groupName: string };
type StudyPlanLine = { page: number; text: string };

const termHeading = /^(?:#{1,6}\s*)?ปีที่\s*(\d+)\s*ภาคการศึกษาที่\s*(\d+)/;

function cleanRow(value: string) {
  return value
    .replace(/^\|\s*|\s*\|$/g, "")
    .replace(/\*\*/g, "")
    .replace(/\\n$/, "")
    .trim();
}

/**
 * Reads the regular term-by-term Study Plan table produced by the OCR stage.
 * This deliberately runs before accepting an empty model response: course
 * codes, names, credits, and Thai term headings are structured enough to
 * extract deterministically without guessing curriculum-wide totals.
 */
function parseStudyPlanLines(lines: StudyPlanLine[], sourceDocumentId: string): AcademicProfileExtraction {
  const courses: ParsedCourse[] = [];
  let group: { id: string; name: string } | null = null;

  for (const item of lines) {
    const line = cleanRow(item.text);
    const heading = line.match(termHeading);
    if (heading) {
      group = {
        id: `year-${heading[1]}-term-${heading[2]}`,
        name: `ปีที่ ${heading[1]} ภาคการศึกษาที่ ${heading[2]}`,
      };
      continue;
    }
    if (!group) continue;

    // PDF text layers can split a course code across adjacent positioned text
    // items (for example, "012042" + "16"). Join only the leading digits.
    const normalizedLine = line.replace(/^(?:(\d+)\s+){1,3}(\d+)(?=\s)/, (value) => {
      const code = value.replace(/\s/g, "");
      return code.length === 8 ? `${code} ` : value;
    });
    const codeMatch = normalizedLine.match(/^(\d{8})\s+(.+)$/);
    if (!codeMatch) continue;
    const creditMatch = codeMatch[2].match(/(?:\|\s*)?([1-9]\d?(?:\.\d+)?)\s*\(/)
      || codeMatch[2].match(/\s+([1-9]\d?(?:\.\d+)?)\s*$/);
    if (!creditMatch || creditMatch.index === undefined) continue;
    const nameTh = codeMatch[2]
      .slice(0, creditMatch.index)
      .replace(/^\|\s*|\|\s*$/g, "")
      .trim();
    if (!nameTh) continue;
    courses.push({
      code: normalizedCourseCode(codeMatch[1]),
      nameTh,
      credits: Number(creditMatch[1]),
      page: item.page,
      groupId: group.id,
      groupName: group.name,
    });
  }

  const uniqueCourses = [...new Map(courses.map(course => [course.code, course])).values()];
  const groups = [...new Map(courses.map(course => [course.groupId, course])).values()];
  return academicProfileExtractionSchema.parse({
    profile: {},
    curriculum: {
      requirementGroups: groups.map(item => ({
        id: item.groupId,
        parentId: null,
        name: item.groupName,
        kind: "required_bucket",
        minimumCredits: null,
        requiredCourseCodes: courses.filter(course => course.groupId === item.groupId).map(course => course.code),
      })),
      requiredCourses: uniqueCourses.map((course, index) => ({
        id: course.code,
        groupId: course.groupId,
        code: course.code,
        nameTh: course.nameTh,
        credits: course.credits,
        evidencePath: `curriculum.requiredCourses.${index}`,
      })),
    },
    catalogCourses: uniqueCourses.map(course => ({
      code: course.code,
      nameTh: course.nameTh,
      credits: course.credits,
      prerequisiteCodes: [],
      requirementGroupIds: [course.groupId],
    })),
    completedCourses: [],
    unresolvedCourses: [],
    evidence: uniqueCourses.map((course, index) => ({
      path: `curriculum.requiredCourses.${index}`,
      sourceDocumentId,
      page: course.page,
      text: `${course.code} ${course.nameTh} ${course.credits}`,
      confidence: 0.95,
    })),
    warnings: [],
    sources: [{ sourceDocumentId, detectedKind: "curriculum" }],
  });
}

export function parseStudyPlanMarkdown(markdown: string, sourceDocumentId: string): AcademicProfileExtraction {
  let page = 1;
  const lines: StudyPlanLine[] = [];
  for (const text of markdown.split("\n")) {
    const pageMarker = text.match(/^---\s*Page\s+(\d+)\s*---$/i);
    if (pageMarker) page = Number(pageMarker[1]); else lines.push({ page, text });
  }
  return parseStudyPlanLines(lines, sourceDocumentId);
}

/** Uses the selectable text layer first, avoiding OCR for native PDF study plans. */
export async function parseStudyPlanPdf(bytes: Uint8Array, sourceDocumentId: string): Promise<AcademicProfileExtraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const lines: StudyPlanLine[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      const value = item as { str?: unknown; transform?: unknown };
      const transform = Array.isArray(value.transform) ? value.transform : [];
      if (typeof value.str !== "string" || typeof transform[4] !== "number" || typeof transform[5] !== "number") continue;
      const y = Math.round(transform[5] / 2.5) * 2.5;
      rows.set(y, [...(rows.get(y) || []), { x: transform[4], text: value.str }]);
    }
    for (const [, row] of [...rows.entries()].sort(([a], [b]) => b - a)) {
      const text = row.sort((a, b) => a.x - b.x).map(item => item.text).join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push({ page: pageNo, text });
    }
  }
  return parseStudyPlanLines(lines, sourceDocumentId);
}
