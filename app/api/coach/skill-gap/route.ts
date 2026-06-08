import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSkillGap } from "@/lib/domain/careerEngine";
import { readCandidateContext, skillsFromResumeText } from "@/lib/domain/coachData";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  targetRole: z.string().trim().max(60).optional(),
  skills: z.array(z.string().trim().max(80)).max(100).optional(),
  resumeText: z.string().trim().max(40000).optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Invalid request body" } }, { status: 400 }); }

  // Resolve candidate skills: explicit > résumé text > DB profile.
  let candidateSkills = body.skills ?? [];
  let targetRole = body.targetRole ?? null;
  let demandCounts = new Map<string, number>();
  if (body.resumeText) candidateSkills = [...new Set([...candidateSkills, ...skillsFromResumeText(body.resumeText)])];
  if (candidateSkills.length === 0 || !targetRole) {
    try {
      const ctx = await readCandidateContext();
      if (candidateSkills.length === 0) candidateSkills = ctx.skills;
      targetRole = targetRole ?? ctx.targetRole;
      demandCounts = ctx.demandCounts;
    } catch { /* deterministic engine still runs */ }
  } else {
    try { demandCounts = (await readCandidateContext()).demandCounts; } catch { /* ignore */ }
  }

  const gap = analyzeSkillGap({ candidateSkills, targetRole, demandCounts });

  let reportId: string | null = null;
  if (body.persist) {
    try {
      const db = createDb();
      const { data } = await db.from("skill_gap_reports").insert({
        scope: "target_role",
        most_requested: gap.missing.slice(0, 10).map((m) => ({ skill: m.skill, demand: m.demand })),
        missing_frequency: gap.missing.map((m) => ({ skill: m.skill, priority: m.priority, difficulty: m.difficulty })),
        market_trends: { targetRole: gap.targetRole, coverage: gap.coverage, have: gap.have },
        model: "deterministic-v1",
      }).select("id").single();
      reportId = data?.id ?? null;
    } catch (e) { console.error("[skill-gap persist]", e); }
  }

  return NextResponse.json({ data: { ...gap, reportId }, error: null });
}
