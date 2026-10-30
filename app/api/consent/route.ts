import { NextResponse } from "next/server";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data, error: queryError } = await db
    .from("workspaces")
    .select("consented_at")
    .eq("id", workspaceId)
    .maybeSingle();
  return queryError ? error("Could not load consent", 500) : NextResponse.json({ consentedAt: data?.consented_at || null });
}

export async function POST() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: existing, error: queryError } = await db
    .from("workspaces")
    .select("consented_at")
    .eq("id", workspaceId)
    .maybeSingle();
  if (queryError || !existing) return error("Could not save consent", 500);
  if (existing.consented_at) return NextResponse.json({ consentedAt: existing.consented_at });
  const consentedAt = new Date().toISOString();
  const { error: updateError } = await db.from("workspaces").update({ consented_at: consentedAt }).eq("id", workspaceId);
  return updateError ? error("Could not save consent", 500) : NextResponse.json({ consentedAt });
}
