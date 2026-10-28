import { NextResponse } from "next/server";
export function error(message: string, status = 400) { return NextResponse.json({ error: { message } }, { status }); }
export function unavailable() { return error("Supabase is not configured. Add environment variables to enable persistence.", 503); }
