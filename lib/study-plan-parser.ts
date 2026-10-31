import { academicProfileExtractionSchema, normalizedCourseCode, type AcademicProfileExtraction } from "@/lib/extraction";

type ParsedCourse = { code: string; nameTh: string; credits: number; page: number; groupId: string; groupName: string };
type ParsedCreditBucket = { id: string; parentId: string; name: string; minimumCredits: number; page: number };
type StudyPlanLine = { page: number; text: string };

const termHeading = /^(?:#{1,6}\s*)?ปีที่\s*(\d+)\s*ภาคการศึกษาที่\s*(\d+)/;

function cleanRow(value: string) {
  return value
    .replace(/^\|\s*|\s*\|$/g, "")
    .replace(/\*\*/g, "")
    .replace(/\\n$/, "")
    .trim();
}

function creditAndName(value: string) {
  const credit = value.match(/(?:\|\s*)?([1-9]\d?(?:\.\d+)?)\s*\(/) || value.match(/\s+([1-9]\d?(?:\.\d+)?)\s*$/);
  if (!credit || credit.index === undefined) return null;
  const name = value.slice(0, credit.index).replace(/^\|\s*|\s*\|$/g, "").trim();
  return name ? { name, credits: Number(credit[1]) } : null;
}

/**
 * Reads the regular term-by-term Study Plan table produced by the OCR stage.
 * This deliberately runs before accepting an empty model response: course
 * codes, names, credits, and Thai term headings are structured enough to
 * extract deterministically without guessing curriculum-wide totals.
 */
function parseStudyPlanLines(lines: StudyPlanLine[], sourceDocumentId: string): AcademicProfileExtraction {
  const courses: ParsedCourse[] = [];
  const creditBuckets: ParsedCreditBucket[] = [];
  const termGroups = new Map<string, { id: string; name: string }>();
  let group: { id: string; name: string } | null = null;

  for (const item of lines) {
    const line = cleanRow(item.text);
    const heading = line.match(termHeading);
    if (heading) {
      group = {
        id: `year-${heading[1]}-term-${heading[2]}`,
        name: `ปีที่ ${heading[1]} ภาคการศึกษาที่ ${heading[2]}`,
      };
      termGroups.set(group.id, group);
      continue;
    }
    if (!group) continue;

    // PDF text layers can split a course code across adjacent positioned text
    // items (for example, "012042" + "16"). Join only the leading digits.
    const normalizedLine = line.replace(/^(?:(\d+)\s+){1,3}(\d+)(?=\s)/, (value) => {
      const code = value.replace(/\s/g, "");
      return code.length === 8 ? `${code} ` : value;
    });
    const codeMatch = normalizedLine.match(/^(\d{8}|\d{2,7}[xX]{1,6})\s+(.+)$/);
    if (codeMatch) {
      const parsed = creditAndName(codeMatch[2]);
      if (!parsed) continue;
      courses.push({ code: normalizedCourseCode(codeMatch[1]), nameTh: parsed.name, credits: parsed.credits, page: item.page, groupId: group.id, groupName: group.name });
      continue;
    }

    // A row with no course code is a selectable/category requirement, not an
    // unnamed required course. Keep its credit target for future matching.
    const parsed = creditAndName(normalizedLine);
    if (!parsed || /^[-–—\d\s|()]+$/.test(parsed.name) || /^(?:รวม(?:\s+\d+)?|total)$/i.test(parsed.name)) continue;
    const activeGroup = group;
    creditBuckets.push({
      id: `${activeGroup.id}-elective-${creditBuckets.filter(bucket => bucket.parentId === activeGroup.id).length + 1}`,
      parentId: activeGroup.id,
      name: parsed.name,
      minimumCredits: parsed.credits,
      page: item.page,
    });
  }

  const uniqueCourses = [...new Map(courses.map(course => [course.code, course])).values()];
  const groups = [...termGroups.values()];
  return academicProfileExtractionSchema.parse({
    profile: {},
    curriculum: {
      requirementGroups: [
        ...groups.map(item => ({
        id: item.id,
        parentId: null,
        name: item.name,
        kind: "required_bucket",
        minimumCredits: null,
        requiredCourseCodes: courses.filter(course => course.groupId === item.id).map(course => course.code),
        })),
        ...creditBuckets.map(bucket => ({ id: bucket.id, parentId: bucket.parentId, name: bucket.name, kind: "elective_bucket" as const, minimumCredits: bucket.minimumCredits, requiredCourseCodes: [] })),
      ],
      requiredCourses: uniqueCourses.map((course, index) => ({
        id: course.code,
        groupId: course.groupId,
        code: course.code,
        nameTh: course.nameTh,
        credits: course.credits,
        evidencePath: `curriculum.requiredCourses.${index}`,
      })),
    },
    catalogCourses: uniqueCourses.filter(course => !/X/.test(course.code)).map(course => ({
      code: course.code,
      nameTh: course.nameTh,
      credits: course.credits,
      prerequisiteCodes: [],
      requirementGroupIds: [course.groupId],
    })),
    completedCourses: [],
    unresolvedCourses: [],
    evidence: [
      ...uniqueCourses.map((course, index) => ({
      path: `curriculum.requiredCourses.${index}`,
      sourceDocumentId,
      page: course.page,
      text: `${course.code} ${course.nameTh} ${course.credits}`,
      confidence: 0.95,
      })),
      ...creditBuckets.map((bucket, index) => ({ path: `curriculum.requirementGroups.${index}`, sourceDocumentId, page: bucket.page, text: `${bucket.name} ${bucket.minimumCredits}`, confidence: 0.9 })),
    ],
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
