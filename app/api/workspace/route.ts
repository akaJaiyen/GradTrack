import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";
import { error, unavailable } from "@/lib/api";
import { currentToken, hashToken, newToken, workspaceCookie } from "@/lib/workspace";

export async function POST() {
  const db = adminDb(); if (!db) return NextResponse.json({ ok: false, demo: true });
  const existing = await currentToken();
  if (existing) return NextResponse.json({ ok: true, existing: true });
  const token = newToken(); const expiresAt = new Date(Date.now() + 30 * 864e5).toISOString();
  const { error: insertError } = await db.from("workspaces").insert({ anonymous_token_hash: hashToken(token), expires_at: expiresAt });
  if (insertError) return error("Could not create workspace", 500);
  const response = NextResponse.json({ ok: true, expiresAt }); response.cookies.set(workspaceCookie(token)); return response;
}
export async function DELETE() {
  const db = adminDb(), token = await currentToken(); if (!db) return unavailable(); if (!token) return NextResponse.json({ ok: true });
  const { data: workspace } = await db.from("workspaces").select("id").eq("anonymous_token_hash", hashToken(token)).maybeSingle();
  if (workspace) { await db.storage.from("private-documents").remove((await db.storage.from("private-documents").list(workspace.id, { limit: 1000 })).data?.map(f => `${workspace.id}/${f.name}`) ?? []); await db.from("workspaces").delete().eq("id", workspace.id); }
  const response = NextResponse.json({ ok: true }); response.cookies.set({ name: "gradtrack_workspace", value: "", maxAge: 0, path: "/" }); return response;
}
