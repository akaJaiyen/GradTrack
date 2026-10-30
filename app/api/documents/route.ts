import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/supabase";
import { currentToken, hashToken } from "@/lib/workspace";
import { error, unavailable } from "@/lib/api";
const maxFileSize = 10 * 1024 * 1024;
const supportedMimeTypes = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Some browsers omit a MIME type or report JPG as image/jpg, so infer it safely from the extension. */
function canonicalMimeType(fileName: string, mimeType: string) {
  const reported = mimeType.toLowerCase().trim();
  if (reported === "image/jpg") return "image/jpeg";
  if (supportedMimeTypes.includes(reported as (typeof supportedMimeTypes)[number])) return reported;
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension === "pdf" ? "application/pdf" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : reported;
}

const input = z.object({
  type: z.enum(["curriculum", "curriculum_summary", "course_catalog", "study_plan", "transcript", "academic_source"]),
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(supportedMimeTypes),
  size: z.number().positive().max(maxFileSize),
});
async function workspace() { const db = adminDb(), token = await currentToken(); if (!db || !token) return { db, id: null }; const { data } = await db.from("workspaces").select("id,expires_at").eq("anonymous_token_hash", hashToken(token)).gt("expires_at", new Date().toISOString()).maybeSingle(); return { db, id: data?.id ?? null }; }
export async function GET() { const { db, id } = await workspace(); if (!db) return unavailable(); if (!id) return error("Unauthorized", 401); const { data, error: queryError } = await db.from("documents").select("id,type,file_name,mime_type,status,extraction_error,created_at").eq("workspace_id", id).order("created_at", { ascending: false }); return queryError ? error("Could not load documents", 500) : NextResponse.json({ data }); }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = input.safeParse(body && { ...body, mimeType: canonicalMimeType(body.fileName ?? "", body.mimeType ?? "") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path[0] === "size" ? "File must be 10 MB or smaller" : issue?.path[0] === "mimeType" ? "Only PDF, JPG, JPEG, and PNG files are supported" : "Invalid upload request";
    return error(message);
  }
  const { db, id } = await workspace(); if (!db) return unavailable(); if (!id) return error("Unauthorized", 401);
  // One active document per role. Replacing a source must also invalidate only
  // the derived data from that source; user-entered rows are deliberately kept.
  const { data: previous, error: previousError } = await db.from("documents").select("id,file_path").eq("workspace_id", id).eq("type", parsed.data.type);
  if (previousError) return error(
    parsed.data.type === "academic_source"
      ? "Academic-profile database migration is required. Apply 0003_academic_profiles.sql in Supabase first."
      : "Could not replace previous document",
    parsed.data.type === "academic_source" ? 503 : 500,
  );
  if (parsed.data.type === "transcript") {
    const { error: clearError } = await db.from("transcript_course_drafts").delete().eq("workspace_id", id);
    if (clearError) return error("Transcript-draft database migration is required. Apply 0011_transcript_course_drafts.sql first.", 503);
  }
  if (parsed.data.type === "curriculum_summary" || parsed.data.type === "course_catalog" || parsed.data.type === "curriculum") {
    const { error: clearError } = await db.from("degree_requirements").delete().eq("workspace_id", id).eq("source", "curriculum");
    if (clearError) return error("Could not clear previous curriculum data", 500);
  }
  if (previous?.length) {
    const { error: storageError } = await db.storage.from("private-documents").remove(previous.map(item => item.file_path));
    if (storageError) return error("Could not remove previous document file", 500);
    const { error: deleteError } = await db.from("documents").delete().in("id", previous.map(item => item.id));
    if (deleteError) return error("Could not remove previous document", 500);
  }
  const documentId = crypto.randomUUID(), safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${id}/${documentId}/${safeName}`;
  const { data: signed, error: signError } = await db.storage.from("private-documents").createSignedUploadUrl(path); if (signError) return error("Could not prepare upload", 500);
  const { error: insertError } = await db.from("documents").insert({ id: documentId, workspace_id: id, type: parsed.data.type, file_path: path, file_name: parsed.data.fileName, mime_type: parsed.data.mimeType, status: "uploaded" });
  if (insertError) return error(insertError.message.includes("document_type") ? "Database migration 0002 is required before uploading this document type" : "Could not save document", 500);
  return NextResponse.json({ documentId, signedUrl: signed.signedUrl, mimeType: parsed.data.mimeType, type: parsed.data.type });
}
