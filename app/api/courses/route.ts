import { NextRequest, NextResponse } from "next/server";
import { error, unavailable } from "@/lib/api";
import { workspaceContext } from "@/lib/server-workspace";
import { courseInputSchema, courseRow } from "@/lib/course-input";
export async function GET() { const {db,workspaceId}=await workspaceContext(); if(!db)return unavailable(); if(!workspaceId)return error("Unauthorized",401); const {data,error:dbError}=await db.from("courses").select("*").eq("workspace_id",workspaceId).eq("verified_by_user",true).order("created_at"); return dbError?error("Could not load courses",500):NextResponse.json({data}); }
export async function POST(request:NextRequest) { const input=courseInputSchema.safeParse(await request.json()); if(!input.success)return error("Invalid course"); const {db,workspaceId}=await workspaceContext(); if(!db)return unavailable(); if(!workspaceId)return error("Unauthorized",401); const {data,error:dbError}=await db.from("courses").insert(courseRow(input.data,workspaceId)).select().single(); return dbError?error("Could not save course",500):NextResponse.json({data},{status:201}); }
