import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { runJson } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import { FEATURE_CONFIG } from "@/lib/ai/models";
import { ANALYZE_SYSTEM, analyzeSchema, analyzeUser } from "@/lib/ai/prompts/resume";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const db = createDb();
  const { resumeId, opportunityId } = (await req.json()) as { resumeId: string; opportunityId?: string };

  const { data: resume } = await db.from("resumes").select("id,parsed_text,target").eq("id", resumeId).single();
  if (!resume?.parsed_text) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Resume text not found" } }, { status: 404 });
  }

  let jobDescription: string | undefined;
  if (opportunityId) {
    const { data: opp } = await db.from("opportunities").select("job_text").eq("id", opportunityId).single();
    jobDescription = opp?.job_text ?? undefined;
  }

  const cfg = FEATURE_CONFIG.resume_analyze;
  const t0 = Date.now();
  try {
    const { data: analysis, tokensIn, tokensOut } = await runJson({
      model: cfg.model, effort: cfg.effort, maxTokens: 6000,
      system: ANALYZE_SYSTEM, schema: analyzeSchema,
      user: analyzeUser({ resumeText: resume.parsed_text, target: resume.target ?? "generic", jobDescription }),
    });

    await logAiUsage({ feature: "resume_analyze", model: cfg.model, tokensIn, tokensOut, latencyMs: Date.now() - t0 });

    const { data: saved, error } = await db.from("resume_analyses").insert({
      resume_id: resumeId, opportunity_id: opportunityId ?? null,
      before_score: analysis.before_score, ats_breakdown: analysis.ats_breakdown,
      matched_keywords: analysis.matched_keywords, missing_keywords: analysis.missing_keywords,
      missing_skills: analysis.missing_skills, weak_sections: analysis.weak_sections,
      suggestions: analysis.suggestions, model: cfg.model,
    }).select("id").single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { id: saved.id, ...analysis }, error: null });
  } catch (e) {
    console.error("[analyze]", e);
    return NextResponse.json({ data: null, error: { code: "AI_ERROR", message: "Analysis failed" } }, { status: 500 });
  }
}
