import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { runJson } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import { FEATURE_CONFIG } from "@/lib/ai/models";
import { REWRITE_SYSTEM, rewriteSchema, rewriteUser } from "@/lib/ai/prompts/resume";
import { resumeTargetSchema } from "@/lib/domain/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const db = createDb();
  const body = (await req.json()) as { resumeId: string; target?: string };
  const target = resumeTargetSchema.parse(body.target ?? "ats");

  const { data: resume } = await db.from("resumes").select("id,parsed_text").eq("id", body.resumeId).single();
  if (!resume?.parsed_text) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Resume text not found" } }, { status: 404 });
  }

  const { data: analysis } = await db
    .from("resume_analyses").select("weak_sections,missing_keywords,suggestions")
    .eq("resume_id", body.resumeId).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const cfg = FEATURE_CONFIG.resume_rewrite;
  const t0 = Date.now();
  try {
    const { data: result, tokensIn, tokensOut } = await runJson({
      model: cfg.model, effort: cfg.effort, maxTokens: 8000,
      system: REWRITE_SYSTEM, schema: rewriteSchema,
      user: rewriteUser({ resumeText: resume.parsed_text, target, analysis: analysis ?? undefined }),
    });

    await logAiUsage({ feature: "resume_rewrite", model: cfg.model, tokensIn, tokensOut, latencyMs: Date.now() - t0 });

    const { data: last } = await db
      .from("resume_versions").select("version_no").eq("resume_id", body.resumeId)
      .order("version_no", { ascending: false }).limit(1).maybeSingle();
    const versionNo = (last?.version_no ?? 0) + 1;

    const { data: saved, error } = await db.from("resume_versions").insert({
      resume_id: body.resumeId, version_no: versionNo, target,
      content_md: result.content_md, ats_score: result.after_score, created_by_ai: true,
    }).select("id,version_no").single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { id: saved.id, version_no: saved.version_no, ...result }, error: null });
  } catch (e) {
    console.error("[rewrite]", e);
    return NextResponse.json({ data: null, error: { code: "AI_ERROR", message: "Rewrite failed" } }, { status: 500 });
  }
}
