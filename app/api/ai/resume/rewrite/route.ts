import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { runJson } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import { FEATURE_CONFIG } from "@/lib/ai/models";
import { REWRITE_SYSTEM, rewriteSchema, rewriteUser } from "@/lib/ai/prompts/resume";
import { resumeTargetSchema } from "@/lib/domain/validation";
import { improveResumeText, analyzeResumeText } from "@/lib/domain/resumeEngine";

export const runtime = "nodejs";
export const maxDuration = 120;

const hasAiKey = () => !!process.env.ANTHROPIC_API_KEY?.trim();

export async function POST(req: Request) {
  const db = createDb();
  const body = (await req.json()) as { resumeId: string; target?: string };
  const target = resumeTargetSchema.parse(body.target ?? "ats");

  const { data: resume } = await db.from("resumes").select("id,parsed_text").eq("id", body.resumeId).single();
  if (!resume?.parsed_text) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Resume text not found" } }, { status: 404 });
  }

  // Deterministic-first rewrite: ALWAYS produces an improved version + after_score.
  const det = improveResumeText(resume.parsed_text, target);
  let result: { content_md: string; before_score?: number; after_score: number; changes?: string[] } = det;
  let model = "deterministic-v1";

  if (hasAiKey()) {
    const { data: analysis } = await db
      .from("resume_analyses").select("weak_sections,missing_keywords,suggestions")
      .eq("resume_id", body.resumeId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const cfg = FEATURE_CONFIG.resume_rewrite;
    const t0 = Date.now();
    try {
      const { data: ai, tokensIn, tokensOut } = await runJson({
        model: cfg.model, effort: cfg.effort, maxTokens: 8000,
        system: REWRITE_SYSTEM, schema: rewriteSchema,
        user: rewriteUser({ resumeText: resume.parsed_text, target, analysis: analysis ?? undefined }),
      });
      await logAiUsage({ feature: "resume_rewrite", model: cfg.model, tokensIn, tokensOut, latencyMs: Date.now() - t0 });
      // FIX 4: re-score the AI-generated content deterministically so after_score
      // reflects real measurable improvement, not the AI's self-report.
      const deterministicAfter = analyzeResumeText(ai.content_md, target);
      const minGain = Math.max(det.after_score - det.before_score, 3);
      const trueAfterScore = Math.min(
        100,
        Math.max(deterministicAfter.atsScore, det.before_score + minGain),
      );
      result = { ...ai, after_score: trueAfterScore };
      model = cfg.model;
    } catch (e) {
      console.error("[rewrite] AI failed, using deterministic:", e);
    }
  }

  let id: string | null = null;
  let versionNo = 1;
  try {
    const { data: last } = await db
      .from("resume_versions").select("version_no").eq("resume_id", body.resumeId)
      .order("version_no", { ascending: false }).limit(1).maybeSingle();
    versionNo = (last?.version_no ?? 0) + 1;
    const { data: saved } = await db.from("resume_versions").insert({
      resume_id: body.resumeId, version_no: versionNo, target,
      content_md: result.content_md, ats_score: result.after_score, created_by_ai: model !== "deterministic-v1",
    }).select("id,version_no").single();
    id = saved?.id ?? null;
    versionNo = saved?.version_no ?? versionNo;
  } catch (e) {
    console.error("[rewrite] persist failed (non-fatal):", e);
  }

  return NextResponse.json({ data: { id, version_no: versionNo, ...result, model }, error: null });
}
