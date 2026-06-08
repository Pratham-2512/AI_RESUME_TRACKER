import "server-only";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { extractRequirements } from "./matchEngine";
import {
  analyzeSkillGap, generateRoadmap, computeCareerReadiness, projectReadiness, applicationReadiness,
  buildRecommendations, type SkillGap, type Roadmap, type CareerReadiness, type Recommendation,
} from "./careerEngine";
import { computeReadiness, type PracticeSession, type QuestionKind } from "./interviewEngine";
import type { Json } from "@/lib/supabase/database.types";

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
}

export type CoachDashboard = {
  ready: boolean;
  targetRole: string;
  targetRoleLabel: string;
  skillCount: number;
  candidateSkills: string[];
  gap: SkillGap;
  roadmap: Roadmap;
  readiness: CareerReadiness;
  recommendations: Recommendation[];
  weeklyGoals: string[];
  monthlyGoals: { label: string; detail: string }[];
  savedRoadmapId: string | null;
};

const KINDS = new Set<QuestionKind>(["technical", "behavioral", "hr", "project"]);

export async function getCoachDashboard(targetRoleOverride?: string): Promise<CoachDashboard> {
  const db = createDb();

  const [profile, skillRows, projects, opps, versions, analyses, apps, events, savedRoadmap, primaryResume] = await Promise.all([
    safe(db.from("profiles").select("target_roles").eq("id", OWNER_ID).maybeSingle(), null as null | { target_roles: string[] | null }),
    safe(db.from("skills").select("name"), [] as { name: string }[]),
    safe(db.from("projects").select("highlights,tech_stack"), [] as { highlights: string[] | null; tech_stack: string[] | null }[]),
    safe(db.from("opportunities").select("required_skills").limit(300), [] as { required_skills: string[] | null }[]),
    safe(db.from("resume_versions").select("ats_score").order("created_at", { ascending: false }).limit(1), [] as { ats_score: number | null }[]),
    safe(db.from("resume_analyses").select("before_score,after_score").order("created_at", { ascending: false }).limit(1), [] as { before_score: number | null; after_score: number | null }[]),
    safe(db.from("applications").select("status,created_at"), [] as { status: string; created_at: string }[]),
    safe(db.from("analytics_events").select("feature,props").eq("type", "interview_practice").limit(200), [] as { feature: string | null; props: Json }[]),
    safe(db.from("learning_roadmaps").select("id").order("created_at", { ascending: false }).limit(1), [] as { id: string }[]),
    safe(db.from("resumes").select("parsed_text").order("is_primary", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(), null as null | { parsed_text: string | null }),
  ]);

  // Skills come from the dedicated table; if empty, fall back to skills parsed from the primary résumé.
  const candidateSkills = skillRows.length
    ? skillRows.map((s) => s.name)
    : primaryResume?.parsed_text ? extractRequirements(primaryResume.parsed_text).skills : [];
  const targetRole = targetRoleOverride || profile?.target_roles?.[0] || "full_stack";

  // Live demand counts from the user's own opportunity pool.
  const demandCounts = new Map<string, number>();
  for (const o of opps) for (const s of o.required_skills ?? []) demandCounts.set(s, (demandCounts.get(s) ?? 0) + 1);

  const gap = analyzeSkillGap({ candidateSkills, targetRole, demandCounts });
  const roadmap = generateRoadmap({ missing: gap.missing, targetRole: gap.targetRole, haveCount: gap.have.length });

  // ---- Component readiness scores ----
  const resumeScore = versions[0]?.ats_score ?? analyses[0]?.after_score ?? analyses[0]?.before_score ?? null;

  const sessions: PracticeSession[] = events.flatMap((e) => {
    const p = (e.props ?? {}) as unknown as Record<string, unknown>;
    const kind = String(p.kind ?? e.feature ?? "") as QuestionKind;
    if (!KINDS.has(kind)) return [];
    const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
    return [{ kind, communication: num("communication"), technical: num("technical"), confidence: num("confidence"), completeness: num("completeness"), overall: num("overall") }];
  });
  const interviewReadiness = computeReadiness(sessions).overall;

  const projReadiness = projectReadiness({
    projectCount: projects.length,
    withHighlights: projects.filter((p) => (p.highlights ?? []).length > 0).length,
    withTech: projects.filter((p) => (p.tech_stack ?? []).length > 0).length,
  });

  const total = apps.length;
  const since = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = apps.filter((a) => new Date(a.created_at).getTime() >= since).length;
  const active = apps.filter((a) => !["saved", "rejected", "ghosted"].includes(a.status)).length;
  const appReadiness = applicationReadiness({ total, active, thisWeek });

  const readiness = computeCareerReadiness({
    resume: resumeScore,
    interview: sessions.length ? interviewReadiness : null,
    skills: gap.coverage,
    projects: projects.length ? projReadiness : null,
    applications: total ? appReadiness : null,
  });

  const recommendations = buildRecommendations({
    readiness, gap, interviewSessions: sessions.length, projectCount: projects.length,
    applicationsThisWeek: thisWeek, resumeScore,
  });

  // Weekly goals = the four foundation-phase week focuses; monthly = phase summaries.
  const weeklyGoals = roadmap.phases[0].weeks.map((w) => `Week ${w.week}: ${w.focus}`);
  const monthlyGoals = roadmap.phases.map((ph) => ({
    label: ph.label,
    detail: ph.weeks.flatMap((w) => w.skills).filter(Boolean).slice(0, 4).join(", ") || ph.weeks.map((w) => w.focus)[0],
  }));

  return {
    ready: candidateSkills.length > 0 || total > 0 || opps.length > 0 || !!profile,
    targetRole: gap.targetRole,
    targetRoleLabel: gap.targetRoleLabel,
    skillCount: candidateSkills.length,
    candidateSkills,
    gap,
    roadmap,
    readiness,
    recommendations,
    weeklyGoals,
    monthlyGoals,
    savedRoadmapId: savedRoadmap[0]?.id ?? null,
  };
}

/** Pull the candidate skill list (used by the skill-gap API when no override is given). */
export async function readCandidateContext(): Promise<{ skills: string[]; targetRole: string | null; demandCounts: Map<string, number> }> {
  const db = createDb();
  const [profile, skillRows, opps, primaryResume] = await Promise.all([
    safe(db.from("profiles").select("target_roles").eq("id", OWNER_ID).maybeSingle(), null as null | { target_roles: string[] | null }),
    safe(db.from("skills").select("name"), [] as { name: string }[]),
    safe(db.from("opportunities").select("required_skills").limit(300), [] as { required_skills: string[] | null }[]),
    safe(db.from("resumes").select("parsed_text").order("is_primary", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(), null as null | { parsed_text: string | null }),
  ]);
  const demandCounts = new Map<string, number>();
  for (const o of opps) for (const s of o.required_skills ?? []) demandCounts.set(s, (demandCounts.get(s) ?? 0) + 1);
  const skills = skillRows.length
    ? skillRows.map((s) => s.name)
    : primaryResume?.parsed_text ? extractRequirements(primaryResume.parsed_text).skills : [];
  return { skills, targetRole: profile?.target_roles?.[0] ?? null, demandCounts };
}

/** Extract skills from raw résumé text (used as a fallback skill source). */
export function skillsFromResumeText(text: string): string[] {
  return extractRequirements(text).skills;
}
