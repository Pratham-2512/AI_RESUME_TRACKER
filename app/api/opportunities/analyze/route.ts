import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreMatch } from "@/lib/domain/matchEngine";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  jobText: z.string().trim().max(40000).optional(),
  jobUrl: z.string().url().optional(),
  // optional override (lets the feature work statelessly without a DB)
  skills: z.array(z.string()).optional(),
  candidateYears: z.number().nullable().optional(),
  persist: z.boolean().optional(),
});

async function fetchJobText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 AICareerOS" } });
  const html = await res.text();
  // crude readable-text extraction
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 40000);
}

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Provide jobText or jobUrl" } }, { status: 400 });
  }

  // 1. Resolve job text
  let jobText = body.jobText ?? "";
  if (!jobText && body.jobUrl) {
    try { jobText = await fetchJobText(body.jobUrl); }
    catch { return NextResponse.json({ data: null, error: { code: "FETCH_FAILED", message: "Could not fetch that URL — paste the description instead." } }, { status: 422 }); }
  }
  if (jobText.trim().length < 30) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Job text too short" } }, { status: 400 });
  }

  // 2. Resolve candidate skills: explicit override, else from DB (graceful), else empty
  let candidateSkills = body.skills ?? [];
  let candidateYears = body.candidateYears ?? null;
  if (!body.skills) {
    try {
      const db = createDb();
      const [{ data: skills }, { data: profile }] = await Promise.all([
        db.from("skills").select("name"),
        db.from("profiles").select("years_experience").eq("id", OWNER_ID).maybeSingle(),
      ]);
      candidateSkills = (skills ?? []).map((s) => s.name);
      candidateYears = profile?.years_experience ?? null;
    } catch { /* no DB yet — deterministic engine still runs on JD alone */ }
  }

  // 3. Deterministic match (no LLM needed)
  const result = scoreMatch({ jobText, candidateSkills, candidateYears });

  // 4. Best-effort persist as a single opportunity (only if DB reachable AND opted in)
  let persistedJobId: string | null = null;
  if (body.persist) {
    try {
      const db = createDb();
      const title = (jobText.split("\n").find((l) => l.trim().length > 5) ?? "Pasted job").slice(0, 120);
      const { data: opp } = await db.from("opportunities").insert({
        title, url: body.jobUrl ?? null, job_text: jobText.slice(0, 20000), source: body.jobUrl ? "url" : "paste",
        required_skills: result.requirements.skills, years_required: result.requirements.yearsRequired,
        match_score: result.matchScore,
        interview_prob_label: result.interviewProbability.label, interview_prob_pct: result.interviewProbability.pct,
        matched_skills: result.matchedSkills, missing_skills: result.missingSkills,
        strengths: result.strengths, weaknesses: result.weaknesses,
        strategy: result.strategy, recommended_resume: result.recommendedResume, model: "deterministic-v1",
      }).select("id").single();
      persistedJobId = opp?.id ?? null;
    } catch (e) { console.error("[opportunities persist]", e); }
  }

  return NextResponse.json({ data: { ...result, persistedJobId }, error: null });
}
