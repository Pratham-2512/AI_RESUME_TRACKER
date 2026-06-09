import type { CareerHealth } from "./careerHealth";
import type { SkillGap } from "./careerEngine";

/**
 * Deterministic advisor text generators for the Copilot. Pure functions over
 * the CareerHealth snapshot — no DB, no LLM. Used by /app/copilot.
 */

export type WeeklyReport = {
  wins: string[];
  losses: string[];
  progress: string[];
  recommendations: string[];
  funnelNotes: string[];
};

export function buildWeeklyReport(h: CareerHealth): WeeklyReport {
  const wins: string[] = [];
  const losses: string[] = [];
  const progress: string[] = [];
  const recommendations: string[] = [];

  // Wins
  if (h.weeklyApplications >= 5) wins.push(`Sent ${h.weeklyApplications} applications this week — strong volume.`);
  if (h.interviewsReceived > 0) wins.push(`${h.interviewsReceived} application(s) reached the interview stage.`);
  if ((h.atsScore ?? 0) >= 75) wins.push(`Résumé ATS score is healthy at ${h.atsScore}/100.`);
  h.dimensions.filter((d) => d.score >= 75).forEach((d) => wins.push(`${d.label} is strong (${d.score}/100).`));

  // Losses / watch-outs
  if (h.daysSinceLastApplication != null && h.daysSinceLastApplication > 14) losses.push(`No applications in ${h.daysSinceLastApplication} days — momentum is stalling.`);
  if (h.daysSinceLastApplication == null) losses.push("No applications on record yet.");
  if ((h.atsScore ?? 100) < 70) losses.push(`Résumé ATS score (${h.atsScore ?? 0}/100) is below the 70 threshold.`);
  if (h.skillGap.missing.length > 5) losses.push(`${h.skillGap.missing.length} priority skills missing for ${h.skillGap.targetRoleLabel}.`);
  if (h.applicationsSent > 0 && h.interviewsReceived === 0) losses.push("Applications are going out but none have converted to interviews.");

  // Progress (weekly trend)
  const wk = h.weeklyProgress;
  if (wk.length >= 2) {
    const last = wk[wk.length - 1].value;
    const prev = wk[wk.length - 2].value;
    if (last > prev) progress.push(`Application activity up week-over-week (${prev} → ${last}).`);
    else if (last < prev) progress.push(`Application activity down week-over-week (${prev} → ${last}).`);
    else progress.push(`Application activity steady at ${last}/week.`);
  }
  progress.push(`Overall career health: ${h.overall}/100.`);
  const weakest = [...h.dimensions].sort((a, b) => a.score - b.score)[0];
  if (weakest) progress.push(`Weakest dimension: ${weakest.label} (${weakest.score}/100).`);

  // Recommendations = top actions
  h.actions.slice(0, 4).forEach((a) => recommendations.push(`${a.title} — ${a.impact}.`));
  if (recommendations.length === 0) recommendations.push("Keep your current cadence — everything is on track.");

  // Funnel notes
  const funnelNotes = buildFunnelNotes(h);

  return { wins, losses, progress, recommendations, funnelNotes };
}

function buildFunnelNotes(h: CareerHealth): string[] {
  const notes: string[] = [];
  if (!h.funnel.length) return notes;
  const applied = h.funnel[0].count;
  const interview = h.funnel.find((f) => f.stage === "Interview")?.count ?? 0;
  const assessment = h.funnel.find((f) => f.stage === "Assessment")?.count ?? 0;
  const offer = h.funnel.find((f) => f.stage === "Offer")?.count ?? 0;
  const rate = (n: number) => (applied ? Math.round((n / applied) * 100) : 0);

  if (rate(assessment) >= 40) notes.push("Your assessment conversion is high — résumé is getting past the first screen.");
  else if (applied >= 5) notes.push("Assessment conversion is low — strengthen the résumé/ATS match.");

  if (interview > 0 && rate(interview) >= 30) notes.push("Interview conversion is solid.");
  else if (assessment > 0 && interview === 0) notes.push("Interview conversion is weak — practice interviews to convert assessments.");

  if (offer > 0) notes.push(`You have ${offer} offer-stage application(s).`);
  return notes;
}

/* ---------------- Résumé Advisor (Feature 5) ---------------- */

export type ResumeAdvice = { strengths: string[]; problems: string[]; plan: string[] };

export function buildResumeAdvice(h: CareerHealth): ResumeAdvice {
  const strengths: string[] = [];
  const problems: string[] = [];
  const plan: string[] = [];

  const ats = h.atsScore ?? 0;
  if (ats >= 75) strengths.push(`Strong ATS score (${ats}/100).`);
  if (h.skillGap.have.length >= 5) strengths.push(`Good coverage of ${h.skillGap.targetRoleLabel} skills (${h.skillGap.have.slice(0, 6).join(", ")}).`);
  if (h.skillGap.extraSkills.length) strengths.push(`Breadth beyond the target role: ${h.skillGap.extraSkills.slice(0, 5).join(", ")}.`);
  if (strengths.length === 0) strengths.push("Add a résumé to surface concrete strengths here.");

  if (ats < 70) problems.push(`ATS score is ${ats}/100 — likely missing keywords or quantified impact.`);
  if (h.skillGap.missing.length) problems.push(`Missing role keywords: ${h.skillGap.prioritySkills.join(", ")}.`);
  if (h.dimensions.find((d) => d.key === "resume" && d.score < 60)) problems.push("Résumé quality is low — bullets likely lack measurable impact.");
  if (problems.length === 0) problems.push("No major résumé problems detected.");

  if (ats < 70) plan.push("Add measurable impact metrics (%, $, time saved) to your top bullets.");
  if (h.skillGap.prioritySkills.length) plan.push(`Weave these keywords in where true: ${h.skillGap.prioritySkills.slice(0, 4).join(", ")}.`);
  plan.push("Run the Résumé Inspector and apply the AI/deterministic rewrite suggestions.");

  return { strengths, problems, plan };
}

/* ---------------- Skill Gap 30/60/90 plan (Feature 8) ---------------- */

export type PhasedPlan = { label: string; skills: string[] }[];

export function buildPhasedPlan(gap: SkillGap): PhasedPlan {
  const names = gap.missing.map((m) => m.skill); // already priority-sorted
  return [
    { label: "30-Day Plan", skills: names.slice(0, 2) },
    { label: "60-Day Plan", skills: names.slice(2, 4) },
    { label: "90-Day Plan", skills: names.slice(4, 6) },
  ];
}
