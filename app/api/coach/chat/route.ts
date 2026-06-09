import { NextResponse } from "next/server";
import { z } from "zod";
import { createDb } from "@/lib/supabase/db";
import { getCoachDashboard } from "@/lib/domain/coachData";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});

/**
 * Deterministic, grounded career-coach reply. No LLM — routes the question to the
 * user's real data (skill gap, roadmap, readiness, recommendations). If an
 * ANTHROPIC_API_KEY is later added, this can be upgraded to a generative answer.
 */
function coachReply(message: string, ctx: Awaited<ReturnType<typeof getCoachDashboard>>): string {
  const m = message.toLowerCase();
  const top = ctx.gap.missing.slice(0, 3).map((g) => g.skill);
  const has = (...keys: string[]) => keys.some((k) => m.includes(k));

  if (has("skill", "gap", "learn what", "what should i learn", "missing")) {
    if (!top.length) return `For ${ctx.targetRoleLabel}, you already cover the core role skills (${ctx.gap.coverage}% coverage). Focus on depth and a portfolio project rather than new skills.`;
    return `For ${ctx.targetRoleLabel} you're at ${ctx.gap.coverage}% skill coverage. Highest-priority gaps: ${top.join(", ")}. Start with ${top[0]} — ${ctx.gap.missing[0].learn}`;
  }
  if (has("roadmap", "plan", "30 day", "60 day", "90 day", "schedule", "study")) {
    const wk = ctx.roadmap.weeks.slice(0, 3).map((w) => `Week ${w.week}: ${w.focus}`).join(" · ");
    return `Here's the start of your 90-day plan for ${ctx.targetRoleLabel}: ${wk}. Each phase ends in a portfolio project. Open the roadmap below for all 12 weeks.`;
  }
  if (has("resume", "cv", "ats")) {
    return `Résumé readiness is ${ctx.readiness.resume}/100. ${ctx.readiness.resume < 75 ? "Add quantified bullets (numbers, %, outcomes) and mirror target-role keywords — use the Tailoring Studio." : "It's in good shape — keep tailoring per job."}`;
  }
  if (has("not getting interview", "no interview", "why am i not", "not hearing back", "no response", "no callback", "rejected", "ghosted", "no callbacks", "not getting any")) {
    const reasons: string[] = [];
    if (ctx.readiness.resume < 75) reasons.push(`your résumé/ATS is ${ctx.readiness.resume}/100 — tighten keywords and add quantified impact`);
    if (ctx.gap.coverage < 70) reasons.push(`skill coverage is ${ctx.gap.coverage}% for ${ctx.targetRoleLabel}${top.length ? ` (missing ${top.join(", ")})` : ""}`);
    if (ctx.readiness.applications < 60) reasons.push(`application volume is low (${ctx.readiness.applications}/100) — apply to more high-match roles`);
    const lead = reasons.length
      ? `A few likely causes: ${reasons.join("; ")}.`
      : "Your résumé, skills, and volume all look solid — this is likely a targeting issue, so focus on higher-match roles.";
    return `${lead} Fix the biggest lever first: ${reasons[0] ?? "tailor each résumé to the job and prioritize high-match openings"}.`;
  }
  if (has("interview", "practice", "mock")) {
    return `Interview readiness is ${ctx.readiness.interview}/100. Generate an interview kit for a target role and practice answers — the evaluator scores communication, technical depth, confidence, and completeness, and checks STAR structure for behavioral questions.`;
  }
  if (has("apply", "application", "job", "opportunit")) {
    return `Application readiness is ${ctx.readiness.applications}/100. Aim for 5–10 targeted applications a week on high-match roles, and tailor your résumé to each.`;
  }
  if (has("project", "portfolio")) {
    return `Projects matter — recruiters want proof of work. Your roadmap ends each phase with a portfolio project. Build something that uses ${top.slice(0, 2).join(" and ") || "your strongest skills"}, document it, and add it to your résumé.`;
  }
  if (has("salary", "pay", "offer", "negotiat")) {
    return "Research the market band for the role and location, anchor to your strongest matching skills and quantified impact, and let them name a number first when possible. Counter with depth of impact, not tenure.";
  }
  if (has("readiness", "ready", "score", "how am i")) {
    const r = ctx.readiness;
    return `Overall career readiness: ${r.overall}/100 → Résumé ${r.resume}, Interview ${r.interview}, Skills ${r.skills}, Projects ${r.projects}, Applications ${r.applications}. Weakest area: ${r.weakest?.key ?? "—"}. Tackle that first.`;
  }
  // Default — surface the top recommendation.
  const rec = ctx.recommendations[0];
  return `${rec ? rec.text : "Tell me about your skills, target role, résumé, or interview prep and I'll give you a concrete next step."} (Ask me about your skill gap, roadmap, résumé, interviews, or readiness.)`;
}

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Provide a message." } }, { status: 400 }); }

  let ctx: Awaited<ReturnType<typeof getCoachDashboard>>;
  try { ctx = await getCoachDashboard(); }
  catch { return NextResponse.json({ data: null, error: { code: "DB", message: "Coach data unavailable." } }, { status: 500 }); }

  const reply = coachReply(body.message, ctx);

  // Persist the turn into coaching_sessions / coaching_messages.
  let sessionId = body.sessionId ?? null;
  try {
    const db = createDb();
    if (!sessionId) {
      const { data } = await db.from("coaching_sessions").insert({ title: body.message.slice(0, 80) }).select("id").single();
      sessionId = data?.id ?? null;
    }
    if (sessionId) {
      await db.from("coaching_messages").insert([
        { session_id: sessionId, role: "user", content: body.message },
        { session_id: sessionId, role: "assistant", content: reply },
      ]);
      await db.from("coaching_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
    }
  } catch (e) { console.error("[coach chat persist]", e); }

  return NextResponse.json({ data: { reply, sessionId }, error: null });
}
