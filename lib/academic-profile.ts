import { academicProfileExtractionSchema, normalizedCourseCode, type AcademicProfileExtraction } from "@/lib/extraction";

export function emptyAcademicProfile(): AcademicProfileExtraction {
  return academicProfileExtractionSchema.parse({
    profile: {}, curriculum: {}, catalogCourses: [], completedCourses: [], unresolvedCourses: [], evidence: [], warnings: [], sources: [],
  });
}

/** Merges independently read files without trusting a model to combine files. */
export function mergeAcademicExtractions(extractions: AcademicProfileExtraction[]) {
  const result = emptyAcademicProfile();
  const catalogs = new Map<string, AcademicProfileExtraction["catalogCourses"][number]>();
  const completed = new Map<string, AcademicProfileExtraction["completedCourses"][number]>();
  const groups = new Map<string, AcademicProfileExtraction["curriculum"]["requirementGroups"][number]>();
  const unresolved = new Set<string>();
  const warnings = new Set<string>();

  for (const extraction of extractions) {
    for (const [key, value] of Object.entries(extraction.profile)) {
      if (key !== "status" && value && (!result.profile[key as keyof typeof result.profile] || result.profile[key as keyof typeof result.profile] === "unknown")) {
        (result.profile as Record<string, unknown>)[key] = value;
      }
    }
    result.profile.languages = [...new Set([...result.profile.languages, ...extraction.profile.languages])];
    for (const group of extraction.curriculum.requirementGroups) if (!groups.has(group.id)) groups.set(group.id, group);
    if (result.curriculum.totalCreditsRequired === null && extraction.curriculum.totalCreditsRequired !== null) result.curriculum.totalCreditsRequired = extraction.curriculum.totalCreditsRequired;
    for (const course of extraction.catalogCourses) {
      const key = normalizedCourseCode(course.code);
      const old = catalogs.get(key);
      catalogs.set(key, old ? { ...course, nameTh: old.nameTh || course.nameTh, nameEn: old.nameEn || course.nameEn, credits: old.credits || course.credits, prerequisiteCodes: [...new Set([...old.prerequisiteCodes, ...course.prerequisiteCodes])], requirementGroupIds: [...new Set([...old.requirementGroupIds, ...course.requirementGroupIds])] } : { ...course, code: key });
    }
    for (const course of extraction.completedCourses) {
      const key = normalizedCourseCode(course.code);
      if (!completed.has(key)) completed.set(key, { ...course, code: key });
    }
    for (const course of extraction.unresolvedCourses) {
      const key = `${course.sourceText}|${course.reason}`;
      if (!unresolved.has(key)) { unresolved.add(key); result.unresolvedCourses.push(course); }
    }
    for (const warning of extraction.warnings) warnings.add(warning);
    result.evidence.push(...extraction.evidence);
    result.sources.push(...extraction.sources);
  }
  result.curriculum.requirementGroups = [...groups.values()];
  result.catalogCourses = [...catalogs.values()];
  result.completedCourses = [...completed.values()];
  result.warnings = [...warnings];
  if (result.warnings.length || result.unresolvedCourses.length) result.profile.status = "ready_with_warnings";
  return academicProfileExtractionSchema.parse(result);
}

export function requirementsFromProfile(profile: AcademicProfileExtraction) {
  const rows: Array<{ category: string; type: "required_course" | "elective_credit" | "total_credit"; code: string | null; name: string | null; minimumCredits: number | null }> = [];
  if (profile.curriculum.totalCreditsRequired !== null) rows.push({ category: "หน่วยกิตรวม", type: "total_credit", code: null, name: null, minimumCredits: profile.curriculum.totalCreditsRequired });
  for (const group of profile.curriculum.requirementGroups) {
    if ((group.kind === "elective_bucket" || group.kind === "credit_bucket") && group.minimumCredits !== null) rows.push({ category: group.name, type: "elective_credit", code: null, name: null, minimumCredits: group.minimumCredits });
    for (const code of group.requiredCourseCodes) {
      const catalog = profile.catalogCourses.find(course => normalizedCourseCode(course.code) === normalizedCourseCode(code));
      rows.push({ category: group.name, type: "required_course", code: normalizedCourseCode(code), name: catalog?.nameTh || catalog?.nameEn || null, minimumCredits: catalog?.credits ?? null });
    }
  }
  return rows;
}
