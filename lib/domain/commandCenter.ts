import "server-only";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";

export type CoachSuggestion = { priority: "high" | "medium" | "low"; text: string; href?: string };

export type CommandCenter = {
  ready: boolean;
  resumeHealth: number | null;
  atsScore: number | null;
  applicationsThisWeek: number;
  interviewRate: number;
  offerRate: number;
  totalApplications: number;
  priorityJobs: { id: string; title: string; company: string | null; score: number | null }[];
  topSkillGaps: string[];
  learningTasks: string[];
  marketTrends: { skill: string; count: number }[];
  coach: CoachSuggestion[];
  profileComplete: boolean;
};

/** Best-effort read of every Command Center input. Tolerates an unapplied schema. */
export async function getCommandCenter(): Promise<CommandCenter> {
  const db = createDb();
  const safe = async <T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> => {
    try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
  };

  const [profile, skills, versions, analyses, apps, opps, roadmap] = await Promise.all([
    safe(db.from("profiles").select("headline,target_roles,summary").eq("id", OWNER_ID).maybeSingle(), null as null | { headline: string | null; target_roles: string[] | null; summary: string | null }),
    safe(db.from("skills").select("name"), [] as { name: string }[]),
    safe(db.from("resume_versions").select("ats_score").order("created_at", { ascending: false }).limit(1), [] as { ats_score: number | null }[]),
    safe(db.from("resume_analyses").select("before_score,missing_skills").order("created_at", { ascending: false }).limit(1), [] as { before_score: number | null; missing_skills: string[] | null }[]),
    safe(db.from("applications").select("status,created_at"), [] as { status: string; created_at: string }[]),
    safe(db.from("opportunities").select("id,title,company,match_score,missing_skills,required_skills,status").order("match_score", { ascending: false }).limit(200), [] as { id: string; title: string; company: string | null; match_score: number | null; missing_skills: string[] | null; required_skills: string[] | null; status: string }[]),
    safe(db.from("learning_roadmaps").select("weeks").order("created_at", { ascending: false }).limit(1), [] as { weeks: unknown }[]),
  ]);

  const total = apps.length;
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  const applicationsThisWeek = apps.filter((a) => new Date(a.created_at).getTime() >= since).length;
  const count = (s: string) => apps.filter((a) => a.status === s).length;
  const interview = count("interview") + count("offer");
  const offer = count("offer");
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const atsScore = versions[0]?.ats_score ?? null;
  const resumeHealth = atsScore ?? analyses[0]?.before_score ?? null;

  // Priority = highest-scored opportunities not yet applied
  const priorityJobs = opps
    .filter((o) => o.status === "saved")
    .slice(0, 5)
    .map((o) => ({ id: o.id, title: o.title, company: o.company, score: o.match_score }));

  const gapFreq = new Map<string, number>();
  for (const o of opps) for (const s of o.missing_skills ?? []) gapFreq.set(s, (gapFreq.get(s) ?? 0) + 1);
  for (const s of analyses[0]?.missing_skills ?? []) gapFreq.set(s, (gapFreq.get(s) ?? 0) + 1);
  const topSkillGaps = [...gapFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s);

  let learningTasks: string[] = [];
  const weeks = roadmap[0]?.weeks as { focus?: string; skills?: string[] }[] | undefined;
  if (Array.isArray(weeks) && weeks[0]) {
    learningTasks = [weeks[0].focus, ...(weeks[0].skills ?? [])].filter(Boolean) as string[];
  } else {
    learningTasks = topSkillGaps.slice(0, 3).map((s) => `Learn the basics of ${s} and ship a small demo`);
  }

  const mFreq = new Map<string, number>();
  for (const o of opps) for (const s of o.required_skills ?? []) mFreq.set(s, (mFreq.get(s) ?? 0) + 1);
  const marketTrends = [...mFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, c]) => ({ skill, count: c }));

  const profileComplete = !!(profile?.headline && (profile?.target_roles?.length ?? 0) > 0 && skills.length >= 3);

  return {
    ready: profile !== null || total > 0 || opps.length > 0,
    resumeHealth, atsScore, applicationsThisWeek,
    interviewRate: pct(interview), offerRate: pct(offer), totalApplications: total,
    priorityJobs, topSkillGaps, learningTasks, marketTrends,
    coach: buildCoach({ profileComplete, resumeHealth, applicationsThisWeek, interviewRate: pct(interview), total, topGaps: topSkillGaps }),
    profileComplete,
  };
}

/** Rule-based coach now; upgrade to the grounded Copilot model later. */
function buildCoach(s: {
  profileComplete: boolean; resumeHealth: number | null; applicationsThisWeek: number;
  interviewRate: number; total: number; topGaps: string[];
}): CoachSuggestion[] {
  const out: CoachSuggestion[] = [];
  if (!s.profileComplete) out.push({ priority: "high", text: "Complete your profile (headline, target roles, 3+ skills) so matching and coaching work.", href: "/app/profile" });
  if (s.resumeHealth == null) out.push({ priority: "high", text: "Add a résumé and run ATS analysis to get your health score.", href: "/app/resumes" });
  else if (s.resumeHealth < 75) out.push({ priority: "high", text: `Résumé health is ${s.resumeHealth}. Run an AI rewrite targeting your role to push it above 80.`, href: "/app/resumes" });
  if (s.applicationsThisWeek < 5) out.push({ priority: "medium", text: `Only ${s.applicationsThisWeek} applications this week. Aim for 5–10 targeted ones.`, href: "/app/jobs" });
  if (s.total >= 8 && s.interviewRate < 15) out.push({ priority: "high", text: `Interview rate is ${s.interviewRate}% across ${s.total} apps — likely a résumé/targeting problem. Tailor per job and fix missing keywords.`, href: "/app/resumes" });
  if (s.topGaps.length) out.push({ priority: "medium", text: `Most-requested skills you're missing: ${s.topGaps.slice(0, 3).join(", ")}. Start there.`, href: "/app/skills" });
  if (out.length === 0) out.push({ priority: "low", text: "You're on track. Keep applying to high-match roles and tailoring each résumé." });
  return out.slice(0, 5);
}
