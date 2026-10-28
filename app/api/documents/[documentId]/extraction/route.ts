import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";
import { confirmedCourseSchema, extractionSchema, normalizedCourseCode } from "@/lib/extraction";
const bodySchema = z.object({ rawExtractionJson: extractionSchema, confidence: z.number().min(0).max(1), status: z.enum(["review_needed", "ready", "failed"]) });
async function allowed(documentId: string) { const { db, workspaceId } = await workspaceContext(); if (!db || !workspaceId) return { db, ok: false }; const { data } = await db.from("documents").select("id").eq("id", documentId).eq("workspace_id", workspaceId).maybeSingle(); return { db, ok: !!data }; }
export async function GET(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params; const access = await allowed(documentId); if (!access.db) return unavailable(); if (!access.ok) return error("Unauthorized", 401); const { data, error: dbError } = await access.db.from("document_extractions").select("raw_extraction_json,confidence,created_at").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle(); return dbError ? error("Could not load extraction", 500) : NextResponse.json({ data }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params, parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return error("Invalid extraction data"); const access = await allowed(documentId); if (!access.db) return unavailable(); if (!access.ok) return error("Unauthorized", 401); const { error: dbError } = await access.db.from("document_extractions").insert({ document_id: documentId, raw_extraction_json: parsed.data.rawExtractionJson, confidence: parsed.data.confidence, extraction_version: "client-ocr-v1" }); if (dbError) return error("Could not save extraction", 500); await access.db.from("documents").update({ status: parsed.data.status }).eq("id", documentId); return NextResponse.json({ ok: true }); }

export async function PUT(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const body = z.object({ courses: z.array(confirmedCourseSchema).min(1).max(500) }).safeParse(await request.json());
  if (!body.success) return error("Invalid courses: each row needs code, name, credits, and a valid grade");
  const { db, workspaceId } = await workspaceContext(); if (!db) return unavailable(); if (!workspaceId) return error("Unauthorized", 401);
  const { data: document } = await db.from("documents").select("id").eq("id", documentId).eq("workspace_id", workspaceId).eq("type", "transcript").maybeSingle();
  if (!document) return error("Transcript not found", 404);
  const { data: existing, error: existingError } = await db.from("courses").select("code").eq("workspace_id", workspaceId);
  if (existingError) return error("Could not validate existing courses", 500);
  const known = new Set((existing || []).map(row => normalizedCourseCode(row.code)));
  const unique = body.data.courses.filter(course => { const code = normalizedCourseCode(course.code); if (known.has(code)) return false; known.add(code); return true; });
  if (unique.length) { const { error: insertError } = await db.from("courses").insert(unique.map(course => ({ workspace_id: workspaceId, code: normalizedCourseCode(course.code), name_th: course.name, credits: course.credits, grade: course.grade || null, source: "transcript", verified_by_user: true }))); if (insertError) return error("Could not confirm courses", 500); }
  await db.from("documents").update({ status: "ready" }).eq("id", documentId);
  return NextResponse.json({ inserted: unique.length, skipped: body.data.courses.length - unique.length });
}
