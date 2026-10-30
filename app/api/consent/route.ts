import { NextResponse } from "next/server";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";
import { TYPHOON_CONSENT_VERSION } from "@/lib/consent";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data, error: queryError } = await db
    .from("workspaces")
    .select("consented_at,consent_version")
    .eq("id", workspaceId)
    .maybeSingle();
  return queryError ? error("โหลดข้อมูลความยินยอมไม่ได้ กรุณาใช้ migration 0008_typhoon_document_pipeline.sql กับ Supabase ก่อน", 503) : NextResponse.json({ consentedAt: data?.consented_at || null, consentVersion: data?.consent_version || null });
}

export async function POST() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const { data: existing, error: queryError } = await db
    .from("workspaces")
    .select("consented_at,consent_version")
    .eq("id", workspaceId)
    .maybeSingle();
  if (queryError) return error("โหลดข้อมูลความยินยอมไม่ได้ กรุณาใช้ migration 0008_typhoon_document_pipeline.sql กับ Supabase ก่อน", 503);
  if (!existing) return error("ไม่พบ workspace สำหรับบันทึกความยินยอม", 404);
  if (existing.consented_at && existing.consent_version === TYPHOON_CONSENT_VERSION) return NextResponse.json({ consentedAt: existing.consented_at, consentVersion: existing.consent_version });
  const consentedAt = new Date().toISOString();
  const consentVersion = TYPHOON_CONSENT_VERSION;
  const { error: updateError } = await db.from("workspaces").update({ consented_at: consentedAt, consent_version: consentVersion }).eq("id", workspaceId);
  return updateError ? error("Could not save consent", 500) : NextResponse.json({ consentedAt, consentVersion });
}
