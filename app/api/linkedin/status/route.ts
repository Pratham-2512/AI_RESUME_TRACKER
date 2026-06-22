import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";

export async function GET() {
  const db = createDb();
  const { data } = await db
    .from("profiles")
    .select("linkedin_sub,linkedin_token_expiry")
    .eq("singleton", true)
    .single();

  const connected = !!data?.linkedin_sub;
  const expired = connected && data?.linkedin_token_expiry
    ? new Date(data.linkedin_token_expiry) < new Date()
    : false;

  return NextResponse.json({ connected: connected && !expired, expired });
}
