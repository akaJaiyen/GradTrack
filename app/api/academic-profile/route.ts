import { NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { mergeAcademicExtractions, requirementsFromProfile } from "@/lib/academic-profile";
import { extractWithGemini } from "@/lib/gemini";
import { normalizedCourseCode } from "@/lib/extraction";
import { workspaceContext } from "@/lib/server-workspace";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data, error: dbError } = await db.from("academic_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return dbError
    ? error("Academic-profile database migration is required. Apply 0003_academic_profiles.sql in Supabase first.", 503)
    : NextResponse.json({ data });
}

const input = z.object({ documentIds: z.array(z.string().uuid()).min(1).max(20), consent: z.boolean() });

export async function POST(request: Request) {
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Select one or more uploaded documents");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: existing } = await db.from("academic_profiles").select("consented_at").eq("workspace_id", workspaceId).maybeSingle();
  if (!existing?.consented_at && !body.data.consent) return error("Consent is required before sending documents to Gemini");
  const { data: documents, error: documentError } = await db.from("documents")
    .select("id,file_path,mime_type").eq("workspace_id", workspaceId).eq("type", "academic_source").in("id", body.data.documentIds);
  if (documentError || documents?.length !== body.data.documentIds.length) return error("One or more uploaded documents could not be found", 404);
  await db.from("documents").update({ status: "extracting" }).in("id", body.data.documentIds).eq("workspace_id", workspaceId);
  try {
    const extractions = await Promise.all(documents.map(async document => {
      const { data: file, error: downloadError } = await db.storage.from("private-documents").download(document.file_path);
      if (downloadError || !file) throw new Error("Could not download an uploaded document");
      return extractWithGemini({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: document.mime_type, sourceDocumentId: document.id });
    }));
    const profile = mergeAcademicExtractions(extractions);
    const status = profile.profile.status;
    const requirements = requirementsFromProfile(profile);
    const { error: profileError } = await db.rpc("replace_academic_profile", {
      p_workspace_id: workspaceId, p_extraction: profile, p_source_document_ids: body.data.documentIds, p_status: status,
      p_consented_at: existing?.consented_at || new Date().toISOString(),
      p_courses: profile.completedCourses.map(course => ({ code: normalizedCourseCode(course.code), name_th: course.name, credits: course.credits, grade: course.grade, term: course.term, year: course.academicYear })),
      p_requirements: requirements.map(requirement => ({ category_name: requirement.category, requirement_type: requirement.type, required_course_code: requirement.code, required_course_name: requirement.name, minimum_credits: requirement.minimumCredits })),
    });
    if (profileError) throw profileError;
    await db.from("documents").update({ status: status === "ready" ? "ready" : "review_needed" }).in("id", body.data.documentIds).eq("workspace_id", workspaceId);
    return NextResponse.json({ data: profile });
  } catch (caught) {
    await db.from("documents").update({ status: "failed" }).in("id", body.data.documentIds).eq("workspace_id", workspaceId);
    return error(caught instanceof Error ? caught.message : "Could not read uploaded documents", 500);
  }
}
