import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";

const node = z.object({ id: z.string(), parentId: z.string().optional(), name: z.string().min(1), minimumCredits: z.number().nonnegative(), kind: z.enum(["total", "container", "required_bucket", "elective_bucket"]) });
const course = z.object({ code: z.string().min(2), nameEn: z.string().optional(), credits: z.number().positive() });
const input = z.object({ summaryDocumentId: z.string().uuid(), catalogDocumentId: z.string().uuid(), nodes: z.array(node).min(1), catalog: z.array(course), assignments: z.record(z.string(), z.string()) });

export async function POST(request: NextRequest) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Invalid curriculum draft");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const [{ data: summary }, { data: catalogDocument }] = await Promise.all([
    db.from("documents").select("id").eq("id", parsed.data.summaryDocumentId).eq("workspace_id", workspaceId).eq("type", "curriculum_summary").maybeSingle(),
    db.from("documents").select("id").eq("id", parsed.data.catalogDocumentId).eq("workspace_id", workspaceId).eq("type", "course_catalog").maybeSingle(),
  ]);
  if (!summary || !catalogDocument) return error("Curriculum documents not found", 404);
  const groups = new Map(parsed.data.nodes.map(item => [item.id, item]));
  const total = parsed.data.nodes.find(item => item.kind === "total");
  const topLevelCredits = parsed.data.nodes.filter(item => item.parentId === undefined && item.kind !== "total").reduce((sum, item) => sum + item.minimumCredits, 0);
  if (!total || topLevelCredits !== total.minimumCredits) return error("Curriculum credit totals do not balance");
  for (const parent of parsed.data.nodes.filter(item => item.kind === "container")) {
    const childCredits = parsed.data.nodes.filter(item => item.parentId === parent.id).reduce((sum, item) => sum + item.minimumCredits, 0);
    if (childCredits !== parent.minimumCredits) return error(`Credits in ${parent.name} do not balance`);
  }
  const catalogByCode = new Map(parsed.data.catalog.map(item => [item.code, item]));
  for (const bucket of parsed.data.nodes.filter(item => item.kind === "required_bucket")) {
    const assignedCredits = Object.entries(parsed.data.assignments).filter(([, groupId]) => groupId === bucket.id).reduce((sum, [code]) => sum + (catalogByCode.get(code)?.credits || 0), 0);
    if (assignedCredits !== bucket.minimumCredits) return error(`Required courses in ${bucket.name} need ${bucket.minimumCredits} credits`);
  }
  const rows = [
    { workspace_id: workspaceId, category_name: total.name, requirement_type: "total_credit", minimum_credits: total.minimumCredits, prerequisite_data: [], source: "curriculum", verified_by_user: true },
    ...parsed.data.nodes.filter(item => item.kind === "elective_bucket").map(item => ({ workspace_id: workspaceId, category_name: item.name, requirement_type: "elective_credit", minimum_credits: item.minimumCredits, prerequisite_data: [], source: "curriculum", verified_by_user: true })),
    ...Object.entries(parsed.data.assignments).flatMap(([code, groupId]) => {
      const group = groups.get(groupId), item = catalogByCode.get(code);
      return group?.kind === "required_bucket" && item ? [{ workspace_id: workspaceId, category_name: group.name, requirement_type: "required_course", required_course_code: item.code, required_course_name: item.nameEn || null, minimum_credits: item.credits, prerequisite_data: [], source: "curriculum", verified_by_user: true }] : [];
    }),
  ];
  // Re-saving the same two source documents replaces their generated
  // requirements while retaining user-created (manual) requirements.
  const { error: removeError } = await db.from("degree_requirements").delete().eq("workspace_id", workspaceId).eq("source", "curriculum");
  if (removeError) return error("Could not replace curriculum requirements", 500);
  const { error: insertError } = await db.from("degree_requirements").insert(rows);
  if (insertError) return error("Could not save curriculum requirements", 500);
  const [{ data: summaryExtraction }, { data: catalogExtraction }] = await Promise.all([
    db.from("document_extractions").select("raw_extraction_json,confidence").eq("document_id", summary.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("document_extractions").select("raw_extraction_json,confidence").eq("document_id", catalogDocument.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const draft = { profile: "ku-cpe-2565", nodes: parsed.data.nodes, catalog: parsed.data.catalog, assignments: parsed.data.assignments };
  const { error: extractionError } = await db.from("document_extractions").insert([
    { document_id: summary.id, raw_extraction_json: { ...(summaryExtraction?.raw_extraction_json || {}), curriculumDraft: draft }, confidence: summaryExtraction?.confidence ?? 0, extraction_version: "curriculum-draft-v2" },
    { document_id: catalogDocument.id, raw_extraction_json: { ...(catalogExtraction?.raw_extraction_json || {}), curriculumDraft: draft }, confidence: catalogExtraction?.confidence ?? 0, extraction_version: "curriculum-draft-v2" },
  ]);
  if (extractionError) return error("Could not save curriculum draft", 500);
  await db.from("documents").update({ status: "ready" }).in("id", [summary.id, catalogDocument.id]);
  return NextResponse.json({ inserted: rows.length });
}
