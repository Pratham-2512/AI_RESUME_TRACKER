import "server-only";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { analyzeResumeText } from "./resumeEngine";
import { analyzeSkillGap, applicationReadiness, type SkillGap } from "./careerEngine";
import { computeReadiness, type PracticeSession, type QuestionKind } from "./interviewEngine";
import { computePipelineAnalytics } from "./pipeline";
import { extractRequirements } from "./matchEngine";
import type { AppStatus, Json, ResumeTarget } from "@/lib/supabase/database.types";

/**
 * Career Health — the Copilot's central deterministic intelligence layer.
 * Reads existing tables (no schema changes, no LLM) and derives six named
 * dimensions, an overall score, an action center, and today's priorities.
 * Every read is best-effort so an empty/unapplied schema degrades to zeros
 * rather than throwing.
 */

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const KINDS = new Set<QuestionKind>(["technical", "behavioral", "hr", "project"]);

export type HealthDimension = { key: string; label: string; score: number; detail: string };
export type ActionItem = {
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  impact: string;
  effort: "low" | "medium" | "high";
  href: string;
};

export type CareerHealth = {
  ready: boolean;
  overall: number;
  dimensions: HealthDimension[];
  // headline metrics for dashboard cards
  atsScore: number | null;
  interviewReadiness: number;
  applicationsSent: number;
  interviewsReceived: number;
  offerRate: number;
  missingSkills: string[];
  weeklyApplications: number;
  daysSinceLastApplication: number | null;
  weeklyProgress: { label: string; value: number }[];
  // intelligence
  actions: ActionItem[];
  todaysPriorities: string[];
  skillGap: SkillGap;
  interviewBreakdown: { label: string; value: number }[];
  funnel: { stage: string; count: number }[];
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export async function getCareerHealth(targetRoleOverride?: string): Promise<CareerHealth> {
  const db = createDb();

  const [profile, skillRows, experience, primaryResume, versions, analyses, apps, opps, kits, events, roadmaps, gapReports, sessions] =
    await Promise.all([
      safe(db.from("profiles").select("full_name,phone,location,headline,summary,career_goals,target_roles,years_experience").eq("id", OWNER_ID).maybeSingle(),
        null as null | { full_name: string | null; phone: string | null; location: string | null; headline: string | null; summary: string | null; career_goals: string | null; target_roles: string[] | null; years_experience: number | null }),
      safe(db.from("skills").select("name"), [] as { name: string }[]),
      safe(db.from("experience").select("id"), [] as { id: string }[]),
      safe(db.from("resumes").select("parsed_text,target").order("is_primary", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        null as null | { parsed_text: string | null; target: ResumeTarget | null }),
      safe(db.from("resume_versions").select("ats_score").order("created_at", { ascending: false }).limit(1), [] as { ats_score: number | null }[]),
      safe(db.from("resume_analyses").select("before_score,after_score,missing_skills").order("created_at", { ascending: false }).limit(1), [] as { before_score: number | null; after_score: number | null; missing_skills: string[] | null }[]),
      safe(db.from("applications").select("status,created_at"), [] as { status: string; created_at: string }[]),
      safe(db.from("opportunities").select("required_skills").limit(300), [] as { required_skills: string[] | null }[]),
      safe(db.from("interview_kits").select("id"), [] as { id: string }[]),
      safe(db.from("analytics_events").select("feature,props,created_at").eq("type", "interview_practice").order("created_at", { ascending: false }).limit(200), [] as { feature: string | null; props: Json; created_at: string }[]),
      safe(db.from("learning_roadmaps").select("id,weeks").order("created_at", { ascending: false }).limit(1), [] as { id: string; weeks: Json }[]),
      safe(db.from("skill_gap_reports").select("id"), [] as { id: string }[]),
      safe(db.from("coaching_sessions").select("id"), [] as { id: string }[]),
    ]);

  const ready = !!(profile || skillRows.length || apps.length || primaryResume);

  // ---- candidate skills + target role ----
  const candidateSkills = skillRows.length
    ? skillRows.map((s) => s.name)
    : primaryResume?.parsed_text ? extractRequirements(primaryResume.parsed_text).skills : [];
  const targetRole = targetRoleOverride || profile?.target_roles?.[0] || "full_stack";
  const demandCounts = new Map<string, number>();
  for (const o of opps) for (const s of o.required_skills ?? []) demandCounts.set(s, (demandCounts.get(s) ?? 0) + 1);
  const skillGap = analyzeSkillGap({ candidateSkills, targetRole, demandCounts });

  // ---- DIMENSION 1: Profile Completeness ----
  const profileFields = [
    profile?.full_name, profile?.phone, profile?.location, profile?.headline,
    profile?.summary, profile?.career_goals,
    profile?.target_roles?.length ? "x" : null,
    profile?.years_experience != null ? "x" : null,
    skillRows.length ? "x" : null,
    experience.length ? "x" : null,
  ];
  const filled = profileFields.filter((v) => v != null && String(v).trim() !== "").length;
  const profileScore = clamp((filled / profileFields.length) * 100);

  // ---- DIMENSION 2: Resume Quality (+ ATS score) ----
  const storedAts = versions[0]?.ats_score ?? analyses[0]?.after_score ?? analyses[0]?.before_score ?? null;
  let resumeScore = storedAts;
  let atsScore = storedAts;
  if ((resumeScore == null || atsScore == null) && primaryResume?.parsed_text && primaryResume.parsed_text.trim().length >= 30) {
    const a = analyzeResumeText(primaryResume.parsed_text, (primaryResume.target ?? "generic") as ResumeTarget);
    resumeScore = resumeScore ?? a.qualityScore;
    atsScore = atsScore ?? a.atsScore;
  }
  const resumeDim = clamp(resumeScore ?? 0);

  // ---- DIMENSION 3: Skill Coverage ----
  const skillScore = clamp(skillGap.coverage);

  // ---- DIMENSION 4: Application Activity ----
  const pipeline = computePipelineAnalytics(apps.map((a) => ({ status: a.status as AppStatus })));
  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const weeklyApplications = apps.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length;
  const appScore = clamp(applicationReadiness({ total: pipeline.applied, active: pipeline.active, thisWeek: weeklyApplications }));
  const lastApp = apps.length ? Math.max(...apps.map((a) => new Date(a.created_at).getTime())) : null;
  const daysSinceLastApplication = lastApp ? Math.floor((now - lastApp) / 86400_000) : null;

  // ---- DIMENSION 5: Interview Activity ----
  const practice: PracticeSession[] = [];
  for (const e of events) {
    const p = (e.props ?? {}) as unknown as Record<string, unknown>;
    const kind = String(p.kind ?? e.feature ?? "") as QuestionKind;
    if (!KINDS.has(kind)) continue;
    const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
    practice.push({ kind, communication: num("communication"), technical: num("technical"), confidence: num("confidence"), completeness: num("completeness"), overall: num("overall"), createdAt: e.created_at });
  }
  const interviewReadiness = computeReadiness(practice);
  const interviewScore = practice.length ? interviewReadiness.overall : kits.length ? 25 : 0;

  // ---- DIMENSION 6: Learning Activity ----
  const hasRoadmap = roadmaps.length > 0;
  const roadmapWeeks = Array.isArray(roadmaps[0]?.weeks) ? (roadmaps[0]!.weeks as unknown[]).length : 0;
  const learningScore = clamp(
    (hasRoadmap ? 40 : 0) +
    Math.min(30, roadmapWeeks * 4) +
    Math.min(15, gapReports.length * 8) +
    Math.min(15, sessions.length * 5),
  );

  // ---- OVERALL (weighted) ----
  const dimensions: HealthDimension[] = [
    { key: "resume", label: "Resume Quality", score: resumeDim, detail: storedAts != null ? "From latest analysis" : "Computed from primary résumé" },
    { key: "skills", label: "Skill Coverage", score: skillScore, detail: `${skillGap.have.length}/${skillGap.have.length + skillGap.missing.length} ${skillGap.targetRoleLabel} skills` },
    { key: "applications", label: "Application Activity", score: appScore, detail: `${pipeline.applied} sent · ${pipeline.active} active` },
    { key: "interview", label: "Interview Activity", score: interviewScore, detail: practice.length ? `${practice.length} practice sessions` : kits.length ? `${kits.length} kit(s), no practice yet` : "No practice yet" },
    { key: "profile", label: "Profile Completeness", score: profileScore, detail: `${filled}/${profileFields.length} fields complete` },
    { key: "learning", label: "Learning Activity", score: learningScore, detail: hasRoadmap ? `Roadmap active (${roadmapWeeks} wks)` : "No roadmap yet" },
  ];
  const WEIGHTS: Record<string, number> = { resume: 0.22, skills: 0.22, applications: 0.18, interview: 0.15, profile: 0.13, learning: 0.10 };
  const overall = clamp(dimensions.reduce((a, d) => a + d.score * (WEIGHTS[d.key] ?? 0), 0));

  // ---- ACTION CENTER ----
  const missingSkills = skillGap.prioritySkills.length ? skillGap.prioritySkills : (analyses[0]?.missing_skills ?? []);
  const totalMissing = skillGap.missing.length || (analyses[0]?.missing_skills?.length ?? 0);
  const actions: ActionItem[] = [];
  if (resumeDim < 70) actions.push({ title: "Improve your résumé", reason: `Résumé quality is ${resumeDim}/100 (target 70+).`, priority: "high", impact: "+ATS & recruiter pass-through", effort: "medium", href: "/app/resumes" });
  if (totalMissing > 5) actions.push({ title: "Learn missing skills", reason: `${totalMissing} skills missing for ${skillGap.targetRoleLabel}.`, priority: "high", impact: "Higher match & interview rate", effort: "high", href: "/app/coach" });
  if (daysSinceLastApplication == null || daysSinceLastApplication > 14) actions.push({ title: "Apply to jobs", reason: daysSinceLastApplication == null ? "No applications yet." : `No applications in ${daysSinceLastApplication} days.`, priority: "high", impact: "Fills the top of your funnel", effort: "medium", href: "/app/jobs" });
  if (interviewScore < 60) actions.push({ title: "Practice interviews", reason: `Interview readiness is ${interviewScore}/100 (target 60+).`, priority: "medium", impact: "Better interview conversion", effort: "medium", href: "/app/interview" });
  if (profileScore < 80) actions.push({ title: "Complete your profile", reason: `Profile is ${profileScore}% complete — it powers every other feature.`, priority: "medium", impact: "Sharper AI recommendations", effort: "low", href: "/app/profile" });
  if (learningScore < 50) actions.push({ title: "Start a learning roadmap", reason: "No active 30/60/90-day plan.", priority: "medium", impact: "Structured skill growth", effort: "low", href: "/app/coach" });
  if (weeklyApplications < 5 && (daysSinceLastApplication ?? 99) <= 14) actions.push({ title: "Increase weekly volume", reason: `Only ${weeklyApplications} applications this week (target 5).`, priority: "low", impact: "Compounds your odds", effort: "medium", href: "/app/jobs" });
  actions.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  const todaysPriorities = actions.slice(0, 4).map((a) => a.title);

  return {
    ready,
    overall,
    dimensions,
    atsScore,
    interviewReadiness: interviewScore,
    applicationsSent: pipeline.applied,
    interviewsReceived: pipeline.reachedInterview,
    offerRate: pipeline.offerRate,
    missingSkills: missingSkills.slice(0, 8),
    weeklyApplications,
    daysSinceLastApplication,
    weeklyProgress: weeklyBuckets(apps.map((a) => a.created_at), 8),
    actions,
    todaysPriorities,
    skillGap,
    interviewBreakdown: [
      { label: "Technical", value: interviewReadiness.technical },
      { label: "Behavioral", value: interviewReadiness.behavioral },
      { label: "HR / Fit", value: interviewReadiness.byKind.hr.avg },
      { label: "Projects", value: interviewReadiness.project },
    ],
    funnel: pipeline.applied
      ? [
          { stage: "Applied", count: pipeline.applied },
          { stage: "Assessment", count: pipeline.reachedAssessment },
          { stage: "Interview", count: pipeline.reachedInterview },
          { stage: "Offer", count: pipeline.reachedOffer },
        ]
      : [],
  };
}

function weeklyBuckets(timestamps: string[], weeks: number): { label: string; value: number }[] {
  const now = Date.now();
  const out: { label: string; value: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400_000;
    const end = now - i * 7 * 86400_000;
    const value = timestamps.filter((t) => { const x = new Date(t).getTime(); return x >= start && x < end; }).length;
    out.push({ label: new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" }), value });
  }
  return out;
}
