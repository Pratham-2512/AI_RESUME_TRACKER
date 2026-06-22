import { NextRequest, NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { matchResumeToJD } from "@/lib/domain/jdMatcher";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { resumeId, jobDescription } = (await req.json()) as {
    resumeId: string;
    jobDescription: string;
  };

  if (!resumeId || !jobDescription?.trim()) {
    return NextResponse.json({ error: "resumeId and jobDescription are required" }, { status: 400 });
  }

  const db = createDb();
  const { data: resume } = await db
    .from("resumes")
    .select("parsed_text,target")
    .eq("id", resumeId)
    .single();

  if (!resume?.parsed_text) {
    return NextResponse.json({ error: "Resume not found or not parsed" }, { status: 404 });
  }

  const result = matchResumeToJD(resume.parsed_text, jobDescription);
  return NextResponse.json({ data: result, error: null });
}
