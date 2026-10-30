import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";
import { normalizedCourseCode } from "@/lib/extraction";

const input = z.object({ draftIds: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: NextRequest) {
  const body = input.safeParse(await request.json().catch(() => null));
  if (!body.success) return error("Invalid draft selection");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: drafts, error: draftError } = await db.from("transcript_course_drafts")
    .select("id,code,name,credits,grade,term,year,status").eq("workspace_id", workspaceId).in("id", body.data.draftIds);
  if (draftError) return error("Transcript-draft database migration is required. Apply 0011_transcript_course_drafts.sql first.", 503);
  if (!drafts?.length || drafts.length !== body.data.draftIds.length) return error("Draft not found", 404);
  if (drafts.some(draft => draft.status !== "ready")) return error("ยืนยันได้เฉพาะรายการที่ผ่านการตรวจสอบแล้ว", 409);
  const { data: existing, error: existingError } = await db.from("courses").select("code").eq("workspace_id", workspaceId);
  if (existingError) return error("Could not validate existing courses", 500);
  const known = new Set((existing || []).map(course => normalizedCourseCode(course.code)));
  const accepted = drafts.filter(draft => !known.has(draft.code));
  if (accepted.length) {
    const { error: insertError } = await db.from("courses").insert(accepted.map(draft => ({ workspace_id: workspaceId, code: draft.code, name_th: draft.name, credits: draft.credits, grade: draft.grade, term: draft.term, year: draft.year, source: "transcript", verified_by_user: true })));
    if (insertError) return error("Could not confirm transcript courses", 500);
  }
  const acceptedIds = accepted.map(draft => draft.id);
  if (acceptedIds.length) {
    const { error: updateError } = await db.from("transcript_course_drafts").update({ status: "confirmed" }).in("id", acceptedIds).eq("workspace_id", workspaceId);
    if (updateError) return error("Could not mark transcript drafts as confirmed", 500);
  }
  return NextResponse.json({ confirmed: accepted.length, skipped: drafts.length - accepted.length });
}
