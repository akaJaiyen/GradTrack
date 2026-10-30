import { describe, expect, it } from "vitest";
import { academicProfileExtractionSchema } from "@/lib/extraction";
import { mergeAcademicExtractions, requirementsFromProfile } from "@/lib/academic-profile";

const sourceA = "11111111-1111-4111-8111-111111111111";
const sourceB = "22222222-2222-4222-8222-222222222222";

describe("academic profile schema", () => {
  it("merges curriculum, catalog, and transcript sources into one profile", () => {
    const curriculum = academicProfileExtractionSchema.parse({
      profile: { institution: "Example University", program: "Computer Science", degreeLevel: "bachelor", curriculumYear: "2568", languages: ["th"], status: "ready" },
      curriculum: { totalCreditsRequired: 120, requirementGroups: [{ id: "core", parentId: null, name: "Core", kind: "required_bucket", minimumCredits: 30, requiredCourseCodes: ["CS 101"] }] },
      catalogCourses: [], completedCourses: [], unresolvedCourses: [], evidence: [], warnings: [], sources: [{ sourceDocumentId: sourceA, detectedKind: "curriculum" }],
    });
    const transcript = academicProfileExtractionSchema.parse({
      profile: { languages: ["en"], status: "ready" }, curriculum: {},
      catalogCourses: [{ code: "CS101", nameTh: null, nameEn: "Programming", credits: 3, prerequisiteCodes: [], requirementGroupIds: ["core"] }],
      completedCourses: [{ code: "CS 101", name: "Programming", credits: 3, grade: "A", term: "1", academicYear: 2568 }],
      unresolvedCourses: [{ sourceText: "CS ?", reason: "Code is unclear", suggestedName: "Unknown" }], evidence: [], warnings: [], sources: [{ sourceDocumentId: sourceB, detectedKind: "mixed" }],
    });
    const profile = mergeAcademicExtractions([curriculum, transcript]);
    expect(profile.catalogCourses).toHaveLength(1);
    expect(profile.completedCourses[0].code).toBe("CS101");
    expect(profile.unresolvedCourses).toHaveLength(1);
    expect(requirementsFromProfile(profile)).toEqual(expect.arrayContaining([expect.objectContaining({ type: "total_credit", minimumCredits: 120 }), expect.objectContaining({ type: "required_course", code: "CS101" })]));
  });

  it("rejects a completed course without a code instead of allowing it into calculations", () => {
    const result = academicProfileExtractionSchema.safeParse({ profile: {}, curriculum: {}, catalogCourses: [], completedCourses: [{ code: "", name: "Unknown", credits: 3 }], unresolvedCourses: [], evidence: [], warnings: [], sources: [] });
    expect(result.success).toBe(false);
  });

  it("creates a requirement for a named study-plan course even when no code is published", () => {
    const profile = academicProfileExtractionSchema.parse({
      profile: {}, curriculum: { totalCreditsRequired: 121, requiredCourses: [{ id: "language", groupId: null, code: null, nameTh: "ภาษาต่างประเทศ 1", nameEn: null, credits: 3, evidencePath: "curriculum.requiredCourses.0" }] },
      catalogCourses: [], completedCourses: [], unresolvedCourses: [], evidence: [], warnings: [], sources: [],
    });
    expect(requirementsFromProfile(profile)).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "total_credit", minimumCredits: 121 }),
      expect.objectContaining({ type: "required_course", code: null, name: "ภาษาต่างประเทศ 1", minimumCredits: 3 }),
    ]));
  });
});
