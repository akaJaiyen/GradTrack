import { NextResponse } from "next/server";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";

export async function GET() {
  const { db, workspaceId } = await workspaceContext();
  if (!db) return unavailable();
  if (!workspaceId) return error("Unauthorized", 401);
  const [courses, requirements, matches, plans, scenarios] = await Promise.all([
    db.from("courses").select("*").eq("workspace_id", workspaceId).eq("verified_by_user", true).order("created_at"),
    db.from("degree_requirements").select("*").eq("workspace_id", workspaceId).eq("verified_by_user", true).order("created_at"),
    db.from("course_matches").select("*").eq("workspace_id", workspaceId),
    db.from("study_plans").select("*, planned_courses(*, planner_meetings(*))").eq("workspace_id", workspaceId).order("created_at"),
    db.from("grade_scenarios").select("*, grade_scenario_courses(*)").eq("workspace_id", workspaceId).order("created_at"),
  ]);
  const failure = [courses, requirements, matches, plans, scenarios].find(result => result.error)?.error;
  return failure ? error("Could not load workspace data", 500) : NextResponse.json({
    courses: courses.data, requirements: requirements.data, matches: matches.data, plans: plans.data, scenarios: scenarios.data,
  });
}
