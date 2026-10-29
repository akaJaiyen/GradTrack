import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";
import { confirmedCourseSchema, normalizedCourseCode } from "@/lib/extraction";
// OCR output is intentionally permissive: users must be able to correct an
// imperfect row before the stricter confirmation schema is applied.
const rawExtractionSchema = z.object({ text: z.string().max(2_000_000).optional(), courses: z.array(z.unknown()).max(500).default([]) }).passthrough();
const bodySchema = z.object({ rawExtractionJson: rawExtractionSchema, confidence: z.number().min(0).max(1), status: z.enum(["review_needed", "ready", "failed"]) });
async function allowed(documentId: string) { const { db, workspaceId } = await workspaceContext(); if (!db || !workspaceId) return { db, ok: false }; const { data } = await db.from("documents").select("id").eq("id", documentId).eq("workspace_id", workspaceId).maybeSingle(); return { db, ok: !!data }; }
export async function GET(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params; const access = await allowed(documentId); if (!access.db) return unavailable(); if (!access.ok) return error("Unauthorized", 401); const { data, error: dbError } = await access.db.from("document_extractions").select("raw_extraction_json,confidence,created_at").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle(); return dbError ? error("Could not load extraction", 500) : NextResponse.json({ data }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params, parsed = bodySchema.safeParse(await request.json()); if (!parsed.success) return error("Invalid extraction data"); const access = await allowed(documentId); if (!access.db) return unavailable(); if (!access.ok) return error("Unauthorized", 401); const { error: dbError } = await access.db.from("document_extractions").insert({ document_id: documentId, raw_extraction_json: parsed.data.rawExtractionJson, confidence: parsed.data.confidence, extraction_version: "client-ocr-v1" }); if (dbError) return error("Could not save extraction", 500); await access.db.from("documents").update({ status: parsed.data.status }).eq("id", documentId); return NextResponse.json({ ok: true }); }

export async function PUT(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const body = z.object({ courses: z.array(confirmedCourseSchema).min(1).max(500).optional(), requirements: z.array(z.object({ category: z.string().trim().min(1).max(160), type: z.enum(["required_course", "elective_credit", "total_credit"]), code: z.string().trim().max(40).optional(), name: z.string().trim().max(250).optional(), minimumCredits: z.number().nonnegative().max(999).optional() })).min(1).max(500).optional() }).safeParse(await request.json());
  if (!body.success || (!body.data.courses && !body.data.requirements)) return error("Invalid confirmed extraction");
  const { db, workspaceId } = await workspaceContext(); if (!db) return unavailable(); if (!workspaceId) return error("Unauthorized", 401);
  const { data: document } = await db.from("documents").select("id,type").eq("id", documentId).eq("workspace_id", workspaceId).maybeSingle();
  if (!document) return error("Document not found", 404);
  if (document.type === "curriculum") {
    if (!body.data.requirements) return error("Curriculum needs confirmed requirements");
    const { error: insertError } = await db.from("degree_requirements").insert(body.data.requirements.map(requirement => ({ workspace_id: workspaceId, category_name: requirement.category, requirement_type: requirement.type, required_course_code: requirement.code ? normalizedCourseCode(requirement.code) : null, required_course_name: requirement.name || null, minimum_credits: requirement.minimumCredits ?? null, prerequisite_data: [], source: "curriculum", verified_by_user: true })));
    if (insertError) return error("Could not confirm requirements", 500);
    await db.from("documents").update({ status: "ready" }).eq("id", documentId);
    return NextResponse.json({ inserted: body.data.requirements.length, skipped: 0 });
  }
  if (!body.data.courses) return error("Transcript needs confirmed courses");
  const { data: existing, error: existingError } = await db.from("courses").select("code").eq("workspace_id", workspaceId);
  if (existingError) return error("Could not validate existing courses", 500);
  const known = new Set((existing || []).map(row => normalizedCourseCode(row.code)));
  const unique = body.data.courses.filter(course => { const code = normalizedCourseCode(course.code); if (known.has(code)) return false; known.add(code); return true; });
  if (unique.length) { const { error: insertError } = await db.from("courses").insert(unique.map(course => ({ workspace_id: workspaceId, code: normalizedCourseCode(course.code), name_th: course.name, credits: course.credits, grade: course.grade || null, source: "transcript", verified_by_user: true }))); if (insertError) return error("Could not confirm courses", 500); }
  await db.from("documents").update({ status: "ready" }).eq("id", documentId);
  return NextResponse.json({ inserted: unique.length, skipped: body.data.courses.length - unique.length });
}
