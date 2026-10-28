import { NextRequest, NextResponse } from "next/server";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";

/** A short-lived URL lets the browser run the privacy-preserving local OCR on an existing upload. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: document, error: documentError } = await db.from("documents")
    .select("file_path,file_name,mime_type,type")
    .eq("id", documentId).eq("workspace_id", workspaceId).eq("type", "transcript").maybeSingle();
  if (documentError) return error("Could not load document", 500);
  if (!document) return error("Transcript not found", 404);
  const { data, error: signedError } = await db.storage.from("private-documents").createSignedUrl(document.file_path, 60);
  if (signedError || !data?.signedUrl) return error("Could not prepare document", 500);
  return NextResponse.json({ signedUrl: data.signedUrl, fileName: document.file_name, mimeType: document.mime_type });
}
