import { after, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { emptyAcademicProfile, mergeAcademicExtractions, requirementsFromProfile } from "@/lib/academic-profile";
import { extractTyphoonProfile, isTyphoonRateLimited, renderPdfPages, TyphoonRequestError, typhoonOcrPages } from "@/lib/typhoon";
import { normalizedCourseCode, type AcademicProfileExtraction } from "@/lib/extraction";
import { documentExtractionErrorCode, type DocumentExtractionErrorCode, type ExtractionStage } from "@/lib/document-extraction-error";
import { workspaceContext } from "@/lib/server-workspace";
import { curriculumProgress } from "@/lib/academic-progress";
import { hasTyphoonConsent } from "@/lib/consent";
import { parseKuTranscriptPdf, passesTranscriptAcceptanceGate, type TranscriptDraft } from "@/lib/ku-transcript-parser";

export const runtime = "nodejs";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const [profileResult, coursesResult, requirementsResult, matchesResult, draftsResult] = await Promise.all([
    db.from("academic_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("courses").select("id,code,name_th,name_en,credits,grade,term,year,verified_by_user").eq("workspace_id", workspaceId).eq("verified_by_user", true),
    db.from("degree_requirements").select("id,category_name,requirement_type,required_course_code,required_course_name,minimum_credits").eq("workspace_id", workspaceId),
    db.from("course_matches").select("course_id,degree_requirement_id,status").eq("workspace_id", workspaceId),
    db.from("transcript_course_drafts").select("id,code,name,credits,grade,term,year,status,parser,evidence,document_id").eq("workspace_id", workspaceId).neq("status", "confirmed").order("created_at"),
  ]);
  const { data, error: dbError } = profileResult;
  return dbError
    ? error("Academic-profile database migration is required. Apply 0003_academic_profiles.sql in Supabase first.", 503)
    : draftsResult.error
      ? error("Transcript-draft database migration is required. Apply 0011_transcript_course_drafts.sql in Supabase first.", 503)
      : coursesResult.error || requirementsResult.error || matchesResult.error
      ? error("Could not load academic progress", 500)
      : NextResponse.json({ data, courses: coursesResult.data || [], drafts: draftsResult.data || [], progress: curriculumProgress(coursesResult.data || [], requirementsResult.data || [], matchesResult.data || []) });
}

const input = z.object({ consent: z.boolean() });

function aiTranscriptDrafts(extraction: AcademicProfileExtraction, pageCount: number): TranscriptDraft[] {
  return extraction.completedCourses.map((course, index) => {
    const evidence = extraction.evidence.find(item => item.path === `completedCourses.${index}`);
    const header = evidence?.text.match(/(?:(?:First|Second|Third) Semester|Summer Session)\s+(?:19\d{2}|2\d{3})/i)?.[0] || "";
    const rowText = evidence?.text || "";
    const hasCourseEvidence = rowText.includes(course.code) && rowText.includes(String(course.credits)) && (!course.grade || new RegExp(`(?:^|\\s)${course.grade.replace("+", "\\+")}(?:\\s|$)`).test(rowText));
    const hasCleanName = !/(?:^|\s)(?:A|B\+|B|C\+|C|D\+|D|F|P|S|W|I|N)\s+\d/.test(course.name);
    const status = evidence && evidence.page && evidence.page <= pageCount && course.term && course.academicYear && header && hasCourseEvidence && hasCleanName ? "ready" : "needs_review";
    return { code: normalizedCourseCode(course.code), name: course.name, credits: course.credits, grade: course.grade, term: course.term, academicYear: course.academicYear, evidence: { page: evidence?.page || 0, rowText, termHeader: header }, status, parser: "ai" };
  });
}

export async function POST(request: Request) {
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Invalid extraction request");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: workspace, error: consentQueryError } = await db.from("workspaces").select("consented_at,consent_version").eq("id", workspaceId).maybeSingle();
  if (consentQueryError) return error("โหลดข้อมูลความยินยอมไม่ได้ กรุณาใช้ migration 0008_typhoon_document_pipeline.sql กับ Supabase ก่อน", 503);
  if (!hasTyphoonConsent(workspace) || !body.data.consent) return error("กรุณายินยอมการส่งเอกสารให้ Typhoon ก่อนเริ่มอ่านเอกสาร", 403);
  const { error: draftMigrationError } = await db.from("transcript_course_drafts").select("id").limit(1);
  if (draftMigrationError) return error("Transcript-draft database migration is required. Apply 0011_transcript_course_drafts.sql first.", 503);
  const { data: availableDocuments, error: documentError } = await db.from("documents")
    .select("id,file_path,mime_type,type").eq("workspace_id", workspaceId).in("type", ["study_plan", "transcript", "academic_source"]);
  if (documentError) return error("Could not load uploaded documents", 500);
  // New role-aware uploads take precedence. Existing academic_source rows are
  // retained as a backwards-compatible source until the user replaces them.
  const modernDocuments = availableDocuments?.filter(document => document.type === "study_plan" || document.type === "transcript") || [];
  if (modernDocuments.length && new Set(modernDocuments.map(document => document.type)).size < 2) {
    return error("Upload both Study Plan and Transcript before starting analysis", 409);
  }
  const documents = modernDocuments.length ? modernDocuments : availableDocuments?.filter(document => document.type === "academic_source") || [];
  if (!documents.length) return error("Upload a Study Plan or Transcript first", 404);
  await db.from("documents").update({ status: "extracting", extraction_error: null }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
  after(async () => {
    let extractionFailedIds: string[] = [];
    let stage: ExtractionStage = "typhoon_ocr";
    try {
    type ExtractionSuccess = { document: typeof documents[number]; extraction: Awaited<ReturnType<typeof extractTyphoonProfile>> };
    type ExtractionFailure = { document: typeof documents[number]; error: Error; errorCode: DocumentExtractionErrorCode };
    const extractionAttempts: Array<ExtractionSuccess | ExtractionFailure> = [];
    const transcriptDrafts: Array<{ documentId: string; drafts: TranscriptDraft[] }> = [];
    for (let index = 0; index < documents.length; index += 1) {
      const document = documents[index];
      if (index > 0) await db.from("documents").update({ status: "extracting" }).eq("id", document.id).eq("workspace_id", workspaceId);
      try {
        stage = "storage_download";
        const { data: file, error: downloadError } = await db.storage.from("private-documents").download(document.file_path);
        if (downloadError || !file) throw new Error("Could not download an uploaded document");
        stage = "typhoon_ocr";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const kuTranscript = document.type === "transcript" && document.mime_type === "application/pdf" ? await parseKuTranscriptPdf(bytes) : null;
        const gate = kuTranscript && passesTranscriptAcceptanceGate(kuTranscript.drafts, kuTranscript.pageCount);
        if (kuTranscript && gate?.ok) {
          transcriptDrafts.push({ documentId: document.id, drafts: kuTranscript.drafts });
          const parserExtraction = emptyAcademicProfile();
          parserExtraction.sources = [{ sourceDocumentId: document.id, detectedKind: "transcript" }];
          extractionAttempts.push({ document, extraction: parserExtraction });
          continue;
        }
        const pages = document.mime_type === "application/pdf" ? await renderPdfPages(bytes) : [Buffer.from(bytes).toString("base64")];
        const markdown = await typhoonOcrPages(pages);
        const { error: saveOcrError } = await db.from("document_extractions").insert({ document_id: document.id, raw_extraction_json: { text: markdown }, confidence: 0.5, extraction_version: "typhoon-ocr-v1" });
        if (saveOcrError) throw new Error("Could not save OCR output");
        stage = "typhoon_text";
        const extraction = await extractTyphoonProfile({ text: markdown, sourceDocumentId: document.id, sourceRole: document.type as "study_plan" | "transcript" | "academic_source" });
        if (document.type === "transcript" && (!kuTranscript || !gate?.ok)) {
          const aiDrafts = aiTranscriptDrafts(extraction, pages.length);
          if (passesTranscriptAcceptanceGate(aiDrafts, pages.length).ok) transcriptDrafts.push({ documentId: document.id, drafts: aiDrafts });
        }
        extractionAttempts.push({ document, extraction });
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error("Could not read uploaded document");
        const errorCode = documentExtractionErrorCode(error, stage);
        console.error("Document extraction failed", { stage, errorCode, httpStatus: "status" in error ? error.status : undefined, failureKind: error instanceof TyphoonRequestError ? error.failureKind : undefined });
        extractionAttempts.push({ document, error, errorCode });
        if (isTyphoonRateLimited(error)) break;
      }
    }
    const failures = extractionAttempts.filter((attempt): attempt is ExtractionFailure => "error" in attempt);
    if (failures.length) {
      extractionFailedIds = failures.map(attempt => attempt.document.id);
      const rateLimitedIds = failures.filter(attempt => isTyphoonRateLimited(attempt.error)).map(attempt => attempt.document.id);
      const failedAttempts = failures.filter(attempt => !rateLimitedIds.includes(attempt.document.id));
      const attemptedIds = new Set(extractionAttempts.map(attempt => attempt.document.id));
      await Promise.all([
        rateLimitedIds.length ? db.from("documents").update({ status: "rate_limited", extraction_error: "typhoon_rate_limited" }).in("id", rateLimitedIds).eq("workspace_id", workspaceId) : Promise.resolve(),
        ...failedAttempts.map(attempt => db.from("documents").update({ status: "failed", extraction_error: attempt.errorCode }).eq("id", attempt.document.id).eq("workspace_id", workspaceId)),
        db.from("documents").update({ status: "uploaded", extraction_error: null }).in("id", extractionAttempts.filter(attempt => !("error" in attempt)).map(attempt => attempt.document.id)).eq("workspace_id", workspaceId),
        ...documents.filter(document => !attemptedIds.has(document.id)).map(document => db.from("documents").update({ status: "uploaded", extraction_error: null }).eq("id", document.id).eq("workspace_id", workspaceId)),
      ]);
      throw failures[0].error;
    }
    const extractions = extractionAttempts
      .filter(attempt => "extraction" in attempt)
      .map(attempt => attempt.extraction!);
    const profile = mergeAcademicExtractions(extractions);
    const status = profile.profile.status;
    const requirements = requirementsFromProfile(profile);
    stage = "profile_save";
    const { error: profileError } = await db.rpc("replace_academic_profile", {
      p_workspace_id: workspaceId, p_extraction: profile, p_source_document_ids: documents.map(document => document.id), p_status: status,
      p_consented_at: workspace?.consented_at ?? null,
      p_courses: [],
      p_requirements: requirements.map(requirement => ({ category_name: requirement.category, requirement_type: requirement.type, required_course_code: requirement.code, required_course_name: requirement.name, minimum_credits: requirement.minimumCredits })),
    });
    if (profileError) throw profileError;
    const { error: clearDraftError } = await db.from("transcript_course_drafts").delete().eq("workspace_id", workspaceId).neq("status", "confirmed");
    if (clearDraftError) throw clearDraftError;
    const draftRows = transcriptDrafts.flatMap(({ documentId, drafts }) => drafts.map(draft => ({ workspace_id: workspaceId, document_id: documentId, code: draft.code, name: draft.name, credits: draft.credits, grade: draft.grade, term: draft.term, year: draft.academicYear, status: draft.status, parser: draft.parser, evidence: draft.evidence })));
    if (draftRows.length) {
      const { error: draftError } = await db.from("transcript_course_drafts").insert(draftRows);
      if (draftError) throw draftError;
    }
    await db.from("documents").update({ status: status === "ready" ? "ready" : "review_needed", extraction_error: null }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
    } catch (caught) {
      const errorCode = documentExtractionErrorCode(caught, stage);
      const httpStatus = caught && typeof caught === "object" && "status" in caught ? (caught as { status?: unknown }).status : undefined;
      console.error("Academic profile extraction failed", { stage, errorCode, httpStatus, failureKind: caught instanceof TyphoonRequestError ? caught.failureKind : undefined });
      if (!extractionFailedIds.length) await db.from("documents").update({ status: "failed", extraction_error: errorCode }).in("id", documents.map(document => document.id)).eq("workspace_id", workspaceId);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
