import { adminDb } from "@/lib/supabase";
import { currentToken, hashToken } from "@/lib/workspace";

/** Service-role queries must always be scoped through this helper. */
export async function workspaceContext() {
  const db = adminDb();
  if (!db) return { db: null, workspaceId: null as string | null };
  const token = await currentToken();
  if (!token) return { db, workspaceId: null as string | null };
  const { data } = await db.from("workspaces")
    .select("id")
    .eq("anonymous_token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return { db, workspaceId: data?.id ?? null };
}

export async function ownedId(table: "courses" | "degree_requirements" | "study_plans" | "grade_scenarios", id: string) {
  const context = await workspaceContext();
  if (!context.db || !context.workspaceId) return { ...context, owned: false };
  const { data } = await context.db.from(table).select("id").eq("id", id).eq("workspace_id", context.workspaceId).maybeSingle();
  return { ...context, owned: !!data };
}
