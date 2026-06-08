/**
 * Resume Tailoring engine — deterministic, no LLM.
 * Combines the JD match engine + résumé engine into one tailoring report:
 * ATS match breakdown, skill-gap bars, keyword analysis, and per-bullet
 * improvement suggestions. The LLM layer (actual rewrite) is separate and
 * key-gated; this report is always available.
 */
import { extractRequirements } from "./matchEngine";
import { analyzeResumeText } from "./resumeEngine";
import type { ResumeTarget } from "@/lib/supabase/database.types";

export type AtsMatch = {
  overall: number; keywordMatch: number; skillsMatch: number;
  experienceMatch: number; structure: number; quantification: number;
};
export type GapBar = { skill: string; level: number; have: boolean };
export type BulletImprovement = { original: string; issues: string[]; suggestion: string };

export type TailorReport = {
  matchScore: number;
  interviewProbability: { label: string; pct: number };
  matchedSkills: string[]; missingSkills: string[]; prioritySkills: string[];
  matchedKeywords: string[]; missingKeywords: string[];
  ats: AtsMatch;
  gap: GapBar[];
  bulletImprovements: BulletImprovement[];
  strengths: string[]; weaknesses: string[]; recommendations: string[];
  recommendedResume: ResumeTarget;
};

function maxYears(text: string): number | null {
  const all = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/gi)].map((m) => parseInt(m[1], 10));
  return all.length ? Math.max(...all) : null;
}

export function buildTailorReport(resumeText: string, jdText: string, target: ResumeTarget = "generic"): TailorReport {
  const jd = extractRequirements(jdText);
  const resumeSkills = extractRequirements(resumeText).skills;
  const have = new Set(resumeSkills.map((s) => s.toLowerCase()));

  const required = jd.skills;
  const matchedSkills = required.filter((s) => have.has(s.toLowerCase()));
  const missingSkills = required.filter((s) => !have.has(s.toLowerCase()));

  const resume = analyzeResumeText(resumeText, target);

  // ATS match breakdown (JD-relative)
  const keywordMatch = required.length ? Math.round((matchedSkills.length / required.length) * 100) : 60;
  const skillsMatch = resumeSkills.length ? Math.round((matchedSkills.length / resumeSkills.length) * 100) : keywordMatch;
  const candYears = maxYears(resumeText);
  let experienceMatch = 100;
  if (jd.yearsRequired != null) {
    if (candYears == null) experienceMatch = 50;
    else if (candYears >= jd.yearsRequired) experienceMatch = 100;
    else experienceMatch = Math.max(30, Math.round((candYears / jd.yearsRequired) * 100));
  }
  const structure = resume.atsBreakdown.structure;
  const quantification = resume.quantificationScore;
  const overall = Math.round(
    keywordMatch * 0.3 + skillsMatch * 0.2 + experienceMatch * 0.15 + structure * 0.15 + quantification * 0.2
  );
  const ats: AtsMatch = { overall, keywordMatch, skillsMatch, experienceMatch, structure, quantification };

  // Skill-gap bars (have = 100, missing = 20 so they're visible but clearly low)
  const gap: GapBar[] = required.map((s) => ({ skill: s, have: have.has(s.toLowerCase()), level: have.has(s.toLowerCase()) ? 100 : 20 }));

  // Bullet improvements (deterministic — never invents facts)
  const bulletImprovements: BulletImprovement[] = resume.weakBullets.map((b) => ({
    original: b.text, issues: b.issues, suggestion: b.suggestion ?? "Strengthen with a metric and a strong action verb.",
  }));

  const interviewProbability =
    overall >= 80 ? { label: "High", pct: 65 } :
    overall >= 60 ? { label: "Medium", pct: 40 } :
    overall >= 40 ? { label: "Low", pct: 20 } : { label: "Very low", pct: 8 };

  const recommendations: string[] = [];
  if (missingSkills.length) recommendations.push(`Surface or add these JD keywords where you genuinely have them: ${missingSkills.slice(0, 6).join(", ")}.`);
  if (resume.weakBullets.length) recommendations.push(`Rewrite ${resume.weakBullets.length} weak bullet(s) to lead with a strong verb and a measurable outcome.`);
  if (quantification < 60) recommendations.push("Add metrics (%, $, counts) to more bullets — quantification is low.");
  if (jd.yearsRequired != null && candYears != null && candYears < jd.yearsRequired) recommendations.push(`JD asks for ${jd.yearsRequired}y; lead with depth and impact rather than tenure.`);
  if (!recommendations.length) recommendations.push("Strong alignment — mirror the JD's exact phrasing and apply.");

  return {
    matchScore: overall, interviewProbability,
    matchedSkills, missingSkills, prioritySkills: missingSkills.slice(0, 5),
    matchedKeywords: matchedSkills, missingKeywords: missingSkills,
    ats, gap, bulletImprovements,
    strengths: matchedSkills.slice(0, 8),
    weaknesses: missingSkills.slice(0, 8),
    recommendations,
    recommendedResume: target,
  };
}
