import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTailorReport } from "@/lib/domain/tailorEngine";
import { resumeTargetSchema } from "@/lib/domain/validation";
import { createDb } from "@/lib/supabase/db";
import { runJson } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import { FEATURE_CONFIG } from "@/lib/ai/models";
import { TAILOR_SYSTEM, tailorSchema, tailorUser } from "@/lib/ai/prompts/tailor";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  resumeId: z.string().uuid().optional(),
  resumeText: z.string().trim().max(40000).optional(),
  jdText: z.string().trim().min(30).max(40000),
  target: resumeTargetSchema.optional(),
  generate: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Provide jdText plus resumeId or resumeText" } }, { status: 400 }); }

  // Resolve résumé text
  let resumeText = body.resumeText ?? "";
  let target = body.target ?? "generic";
  if (!resumeText && body.resumeId) {
    try {
      const db = createDb();
      const { data } = await db.from("resumes").select("parsed_text,target").eq("id", body.resumeId).single();
      resumeText = data?.parsed_text ?? "";
      target = (data?.target ?? target) as typeof target;
    } catch { /* no DB */ }
  }
  if (resumeText.trim().length < 30) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Résumé text not found / too short" } }, { status: 400 });
  }

  // Deterministic report — always available
  const report = buildTailorReport(resumeText, body.jdText, target);

  // Optional LLM tailoring — only if a key exists and caller opted in
  let tailored: { content_md: string; changes: string[]; added_keywords: string[]; versionId: string | null } | null = null;
  let aiUnavailable: string | null = null;
  if (body.generate) {
    if (!process.env.ANTHROPIC_API_KEY) {
      aiUnavailable = "AI tailoring requires ANTHROPIC_API_KEY. The analysis above works without it.";
    } else {
      const cfg = FEATURE_CONFIG.resume_rewrite;
      const t0 = Date.now();
      try {
        const { data: result, tokensIn, tokensOut } = await runJson({
          model: cfg.model, effort: cfg.effort, maxTokens: 8000,
          system: TAILOR_SYSTEM, schema: tailorSchema,
          user: tailorUser({ resumeText, jdText: body.jdText, target }),
        });
        await logAiUsage({ feature: "resume_rewrite", model: cfg.model, tokensIn, tokensOut, latencyMs: Date.now() - t0 });

        let versionId: string | null = null;
        if (body.resumeId) {
          try {
            const db = createDb();
            const { data: last } = await db.from("resume_versions").select("version_no").eq("resume_id", body.resumeId).order("version_no", { ascending: false }).limit(1).maybeSingle();
            const { data: saved } = await db.from("resume_versions").insert({
              resume_id: body.resumeId, version_no: (last?.version_no ?? 0) + 1, target,
              content_md: result.content_md, ats_score: report.ats.overall, created_by_ai: true,
            }).select("id").single();
            versionId = saved?.id ?? null;
          } catch (e) { console.error("[tailor persist]", e); }
        }
        tailored = { ...result, versionId };
      } catch (e) {
        console.error("[tailor llm]", e);
        aiUnavailable = "AI tailoring failed — see server logs. Deterministic analysis is unaffected.";
      }
    }
  }

  return NextResponse.json({ data: { report, tailored, aiUnavailable, originalText: resumeText }, error: null });
}
