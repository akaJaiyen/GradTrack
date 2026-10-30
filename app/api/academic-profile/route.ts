import { after, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { mergeAcademicExtractions, requirementsFromProfile } from "@/lib/academic-profile";
import { extractWithGemini } from "@/lib/gemini";
import { normalizedCourseCode } from "@/lib/extraction";
import { workspaceContext } from "@/lib/server-workspace";
import { curriculumProgress } from "@/lib/academic-progress";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const [profileResult, coursesResult, requirementsResult, matchesResult] = await Promise.all([
    db.from("academic_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("courses").select("id,code,name_th,credits,grade").eq("workspace_id", workspaceId),
    db.from("degree_requirements").select("id,category_name,requirement_type,required_course_code,required_course_name,minimum_credits").eq("workspace_id", workspaceId),
    db.from("course_matches").select("course_id,degree_requirement_id,status").eq("workspace_id", workspaceId),
  ]);
  const { data, error: dbError } = profileResult;
  return dbError
    ? error("Academic-profile database migration is required. Apply 0003_academic_profiles.sql in Supabase first.", 503)
    : coursesResult.error || requirementsResult.error || matchesResult.error
      ? error("Could not load academic progress", 500)
      : NextResponse.json({ data, progress: curriculumProgress(coursesResult.data || [], requirementsResult.data || [], matchesResult.data || []) });
}

const input = z.object({ consent: z.boolean() });

export async function POST(request: Request) {
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Invalid extraction request");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: existing } = await db.from("academic_profiles").select("consented_at").eq("workspace_id", workspaceId).maybeSingle();
  if (!existing?.consented_at && !body.data.consent) return error("Consent is required before sending documents to Gemini");
  const { data: availableDocuments, error: documentError } = await db.from("documents")
    .select("id,file_path,mime_type,type").eq("workspace_id", workspaceId).in("type", ["study_plan", "transcript", "academic_source"]);
  if (documentError) return error("Could not load uploaded documents", 500);
  // New role-aware uploads take precedence. Existing academic_source rows are
  // retained as a backwards-compatible source until the user replaces them.
  const modernDocuments = availableDocuments?.filter(document => document.type === "study_plan" || document.type === "transcript") || [];
  const documents = modernDocuments.length ? modernDocuments : availableDocuments?.filter(document => document.type === "academic_source") || [];
  if (!documents.length) return error("Upload a Study Plan or Transcript first", 404);
  await db.from("documents").update({ status: "extracting" }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
  after(async () => {
    let extractionFailedIds: string[] = [];
    try {
    const extractionAttempts = await Promise.all(documents.map(async document => {
      try {
        const { data: file, error: downloadError } = await db.storage.from("private-documents").download(document.file_path);
        if (downloadError || !file) throw new Error("Could not download an uploaded document");
        return { document, extraction: await extractWithGemini({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: document.mime_type, sourceDocumentId: document.id, sourceRole: document.type as "study_plan" | "transcript" | "academic_source" }) };
      } catch (caught) {
        return { document, error: caught instanceof Error ? caught : new Error("Could not read uploaded document") };
      }
    }));
    const failures = extractionAttempts.filter((attempt): attempt is typeof attempt & { error: Error } => "error" in attempt);
    if (failures.length) {
      extractionFailedIds = failures.map(attempt => attempt.document.id);
      await Promise.all([
        db.from("documents").update({ status: "failed" }).in("id", extractionFailedIds).eq("workspace_id", workspaceId),
        db.from("documents").update({ status: "uploaded" }).in("id", extractionAttempts.filter(attempt => !("error" in attempt)).map(attempt => attempt.document.id)).eq("workspace_id", workspaceId),
      ]);
      throw failures[0].error;
    }
    const extractions = extractionAttempts
      .filter(attempt => "extraction" in attempt)
      .map(attempt => attempt.extraction!);
    const profile = mergeAcademicExtractions(extractions);
    const status = profile.profile.status;
    const requirements = requirementsFromProfile(profile);
    const { error: profileError } = await db.rpc("replace_academic_profile", {
      p_workspace_id: workspaceId, p_extraction: profile, p_source_document_ids: documents.map(document => document.id), p_status: status,
      p_consented_at: existing?.consented_at || new Date().toISOString(),
      p_courses: profile.completedCourses.map(course => ({ code: normalizedCourseCode(course.code), name_th: course.name, credits: course.credits, grade: course.grade, term: course.term, year: course.academicYear })),
      p_requirements: requirements.map(requirement => ({ category_name: requirement.category, requirement_type: requirement.type, required_course_code: requirement.code, required_course_name: requirement.name, minimum_credits: requirement.minimumCredits })),
    });
    if (profileError) throw profileError;
    await db.from("documents").update({ status: status === "ready" ? "ready" : "review_needed" }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
    } catch {
      if (!extractionFailedIds.length) await db.from("documents").update({ status: "failed" }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
