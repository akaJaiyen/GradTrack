import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, unavailable } from "@/lib/api";
import { normalizedCourseCode } from "@/lib/extraction";
import { workspaceContext } from "@/lib/server-workspace";

const draftInput = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(500),
  credits: z.number().positive().max(99.9),
  grade: z.enum(["A", "B+", "B", "C+", "C", "D+", "D", "F", "P", "S", "W", "I", "N"]).nullable(),
  term: z.enum(["1", "2", "3", "summer"]).nullable(),
  year: z.number().int().min(1900).max(3000).nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const input = draftInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return error("Invalid transcript draft");
  const { draftId } = await params;
  if (!z.string().uuid().safeParse(draftId).success) return error("Invalid transcript draft");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);

  const { data, error: dbError } = await db.from("transcript_course_drafts")
    .update({ ...input.data, code: normalizedCourseCode(input.data.code), status: "ready" })
    .eq("id", draftId)
    .eq("workspace_id", workspaceId)
    .neq("status", "confirmed")
    .select("id")
    .maybeSingle();
  if (dbError) return error("Could not save transcript draft", 500);
  if (!data) return error("Transcript draft not found", 404);
  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!z.string().uuid().safeParse(draftId).success) return error("Invalid transcript draft");
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { error: dbError } = await db.from("transcript_course_drafts").delete().eq("id", draftId).eq("workspace_id", workspaceId).neq("status", "confirmed");
  return dbError ? error("Could not delete transcript draft", 500) : NextResponse.json({ ok: true });
}
