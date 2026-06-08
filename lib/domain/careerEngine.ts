/**
 * Career Coach engine — deterministic, no LLM.
 * Skill-gap analysis against a target role, a 30/60/90-day learning roadmap,
 * an overall Career Readiness score, and prioritized recommendations.
 * Works with zero API keys; an LLM layer can refine later.
 */
import { skillMeta, roleSkills, roleLabel, type LearnDifficulty } from "./skillData";

// ---------------------------------------------------------------------------
// Skill-gap analysis
// ---------------------------------------------------------------------------
export type GapSkill = {
  skill: string;
  difficulty: LearnDifficulty;
  demand: number;        // blended 0-100
  priority: number;      // 0-100 ranking score (higher = learn first)
  category: string;
  learn: string;
};

export type SkillGap = {
  targetRole: string;
  targetRoleLabel: string;
  have: string[];          // role skills the candidate already has
  missing: GapSkill[];     // role skills they lack, priority-sorted
  prioritySkills: string[];// top missing skill names
  coverage: number;        // % of role skills covered (0-100)
  extraSkills: string[];   // candidate skills outside the role profile
};

const norm = (s: string) => s.toLowerCase().trim();

export function analyzeSkillGap(opts: {
  candidateSkills: string[];
  targetRole: string | null | undefined;
  /** live demand signal: how often each skill appears across the user's opportunities */
  demandCounts?: Map<string, number>;
}): SkillGap {
  const target = opts.targetRole && roleSkills(opts.targetRole) ? opts.targetRole : "full_stack";
  const required = roleSkills(target);
  const have = new Set(opts.candidateSkills.map(norm));

  const maxLive = opts.demandCounts ? Math.max(1, ...[...opts.demandCounts.values()]) : 1;
  const liveDemand = (skill: string): number => {
    if (!opts.demandCounts) return 0;
    const c = opts.demandCounts.get(skill) ?? opts.demandCounts.get(norm(skill)) ?? 0;
    return Math.round((c / maxLive) * 100);
  };

  const haveRole = required.filter((s) => have.has(norm(s)));
  const missingRole = required.filter((s) => !have.has(norm(s)));

  const missing: GapSkill[] = missingRole.map((skill) => {
    const meta = skillMeta(skill);
    const live = liveDemand(skill);
    // Blend baseline market demand with the user's own job-pool signal.
    const demand = opts.demandCounts && live > 0 ? Math.round(meta.demand * 0.6 + live * 0.4) : meta.demand;
    // Priority favors high demand and lower effort (quick, valuable wins first).
    const effortBonus = meta.difficulty === "easy" ? 12 : meta.difficulty === "medium" ? 4 : 0;
    const priority = Math.min(100, Math.round(demand * 0.85 + effortBonus));
    return { skill, difficulty: meta.difficulty, demand, priority, category: meta.category, learn: meta.learn };
  }).sort((a, b) => b.priority - a.priority);

  const extraSkills = opts.candidateSkills.filter((s) => !required.some((r) => norm(r) === norm(s)));
  const coverage = required.length ? Math.round((haveRole.length / required.length) * 100) : 0;

  return {
    targetRole: target,
    targetRoleLabel: roleLabel(target),
    have: haveRole,
    missing,
    prioritySkills: missing.slice(0, 5).map((m) => m.skill),
    coverage,
    extraSkills,
  };
}

// ---------------------------------------------------------------------------
// Learning roadmap (30 / 60 / 90 day)
// ---------------------------------------------------------------------------
export type RoadmapWeek = {
  week: number;
  phase: "30-day" | "60-day" | "90-day";
  focus: string;
  skills: string[];
  activity: string;
};

export type Roadmap = {
  targetRole: string;
  targetRoleLabel: string;
  weeks: RoadmapWeek[];
  phases: { id: "30-day" | "60-day" | "90-day"; label: string; weeks: RoadmapWeek[] }[];
};

const PHASE_OF = (week: number): RoadmapWeek["phase"] => (week <= 4 ? "30-day" : week <= 8 ? "60-day" : "90-day");

/**
 * Builds a 12-week plan. Priority skills are front-loaded (one focus skill per
 * week), and each phase ends on a portfolio project to turn learning into proof.
 */
export function generateRoadmap(opts: {
  missing: GapSkill[];
  targetRole: string;
  haveCount?: number;
}): Roadmap {
  const label = roleLabel(opts.targetRole);
  const ordered = [...opts.missing].sort((a, b) => b.priority - a.priority);
  const weeks: RoadmapWeek[] = [];

  // Project weeks anchor each phase (weeks 4, 8, 12).
  const PROJECT_WEEKS = new Set([4, 8, 12]);
  let skillIdx = 0;

  for (let week = 1; week <= 12; week++) {
    const phase = PHASE_OF(week);
    if (PROJECT_WEEKS.has(week)) {
      const covered = ordered.slice(0, Math.min(skillIdx, ordered.length)).map((s) => s.skill);
      const focusSkills = covered.slice(-3);
      weeks.push({
        week, phase,
        focus: week === 12 ? `Capstone ${label} project` : "Portfolio project",
        skills: focusSkills,
        activity: focusSkills.length
          ? `Build and ship a project that uses ${focusSkills.join(", ")}. Write a short README and add it to your résumé.`
          : `Build and ship a small ${label} project; document it and add it to your résumé.`,
      });
      continue;
    }
    const skill = ordered[skillIdx];
    skillIdx++;
    if (skill) {
      weeks.push({
        week, phase,
        focus: skill.skill,
        skills: [skill.skill],
        activity: `${skill.learn} (≈${skill.difficulty} difficulty, high demand).`,
      });
    } else {
      // No more gaps — use the week to deepen / interview-prep.
      weeks.push({
        week, phase,
        focus: week <= 4 ? "Reinforce fundamentals" : "Mock interviews & depth",
        skills: [],
        activity: week <= 4
          ? `Strengthen core ${label} skills with practice problems.`
          : "Run mock interviews and deepen system-design / project storytelling.",
      });
    }
  }

  const phases = (["30-day", "60-day", "90-day"] as const).map((id) => ({
    id,
    label: id === "30-day" ? "Days 1–30 · Foundations" : id === "60-day" ? "Days 31–60 · Build" : "Days 61–90 · Prove & apply",
    weeks: weeks.filter((w) => w.phase === id),
  }));

  return { targetRole: opts.targetRole, targetRoleLabel: label, weeks, phases };
}

// ---------------------------------------------------------------------------
// Career readiness
// ---------------------------------------------------------------------------
export type CareerReadinessInput = {
  resume: number | null;        // ATS / résumé health 0-100
  interview: number | null;     // interview readiness 0-100
  skills: number | null;        // skill coverage 0-100
  projects: number | null;      // project readiness 0-100
  applications: number | null;  // application momentum 0-100
};

export type CareerReadiness = {
  resume: number;
  interview: number;
  skills: number;
  projects: number;
  applications: number;
  overall: number;
  weakest: { key: string; value: number } | null;
};

const READINESS_WEIGHTS: Record<keyof CareerReadinessInput, number> = {
  resume: 0.25, interview: 0.2, skills: 0.25, projects: 0.15, applications: 0.15,
};
const READINESS_LABELS: Record<keyof CareerReadinessInput, string> = {
  resume: "Résumé", interview: "Interview", skills: "Skills", projects: "Projects", applications: "Applications",
};

export function computeCareerReadiness(input: CareerReadinessInput): CareerReadiness {
  const v = (n: number | null) => Math.max(0, Math.min(100, Math.round(n ?? 0)));
  const parts = {
    resume: v(input.resume), interview: v(input.interview), skills: v(input.skills),
    projects: v(input.projects), applications: v(input.applications),
  };
  const overall = Math.round(
    (Object.keys(parts) as (keyof CareerReadinessInput)[]).reduce((a, k) => a + parts[k] * READINESS_WEIGHTS[k], 0)
  );
  const entries = (Object.keys(parts) as (keyof CareerReadinessInput)[]).map((k) => ({ key: READINESS_LABELS[k], value: parts[k] }));
  const weakest = entries.length ? entries.reduce((min, e) => (e.value < min.value ? e : min)) : null;
  return { ...parts, overall, weakest };
}

/** Project readiness from raw counts: rewards having multiple documented projects. */
export function projectReadiness(opts: { projectCount: number; withHighlights: number; withTech: number }): number {
  if (opts.projectCount === 0) return 0;
  const countScore = Math.min(60, opts.projectCount * 20);          // 3 projects = 60
  const highlightScore = Math.min(25, opts.withHighlights * 9);     // documented impact
  const techScore = Math.min(15, opts.withTech * 5);               // listed tech stack
  return Math.min(100, countScore + highlightScore + techScore);
}

/** Application momentum: rewards a steady, active pipeline. */
export function applicationReadiness(opts: { total: number; active: number; thisWeek: number }): number {
  if (opts.total === 0) return 0;
  const volume = Math.min(50, opts.total * 5);          // 10 apps = 50
  const momentum = Math.min(30, opts.thisWeek * 6);     // 5/week = 30
  const active = Math.min(20, opts.active * 5);         // in-flight pipeline
  return Math.min(100, volume + momentum + active);
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------
export type Recommendation = { priority: "high" | "medium" | "low"; text: string; href?: string };

export function buildRecommendations(ctx: {
  readiness: CareerReadiness;
  gap: SkillGap | null;
  interviewSessions: number;
  projectCount: number;
  applicationsThisWeek: number;
  resumeScore: number | null;
}): Recommendation[] {
  const out: Recommendation[] = [];

  // Skills — top priority gaps
  if (ctx.gap && ctx.gap.missing.length) {
    const top = ctx.gap.missing.slice(0, 2).map((m) => m.skill);
    out.push({ priority: "high", text: `Learn ${top.join(" and ")} — top-demand skills missing for ${ctx.gap.targetRoleLabel}.`, href: "/app/coach" });
    if (ctx.gap.missing[2]) out.push({ priority: "medium", text: `Then pick up ${ctx.gap.missing[2].skill} to round out the role profile.`, href: "/app/coach" });
  }

  // Résumé
  if (ctx.resumeScore == null) out.push({ priority: "high", text: "Add a résumé and run ATS analysis to unlock your readiness score.", href: "/app/resumes" });
  else if (ctx.resumeScore < 75) out.push({ priority: "high", text: `Improve quantified résumé bullets — ATS is ${ctx.resumeScore}. Add metrics and strong verbs.`, href: "/app/tailor" });

  // Projects
  if (ctx.projectCount === 0) out.push({ priority: "high", text: "Build and document at least one portfolio project — recruiters look for proof of work.", href: "/app/coach" });
  else if (ctx.projectCount < 3) out.push({ priority: "medium", text: `You have ${ctx.projectCount} project(s). Aim for 3 strong, documented projects.`, href: "/app/coach" });

  // Interview
  if (ctx.interviewSessions === 0) out.push({ priority: "medium", text: "Generate an interview kit and practice — you have no recorded practice sessions yet.", href: "/app/interview" });
  else if (ctx.readiness.interview < 70) out.push({ priority: "medium", text: `Interview readiness is ${ctx.readiness.interview}. Keep practicing — focus on weak categories.`, href: "/app/interview" });

  // Applications
  if (ctx.applicationsThisWeek < 5) out.push({ priority: "low", text: `Only ${ctx.applicationsThisWeek} applications this week — target 5–10 high-match roles.`, href: "/app/opportunities" });

  // Always have something
  if (!out.length) out.push({ priority: "low", text: "You're on track. Keep practicing interviews and applying to high-match roles." });

  // Stable order: high → medium → low
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
