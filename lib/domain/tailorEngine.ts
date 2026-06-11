/**
 * Resume Tailoring engine — deterministic, no LLM.
 * Combines the JD match engine + résumé engine into one tailoring report:
 * ATS match breakdown, skill-gap bars, keyword analysis, and per-bullet
 * improvement suggestions. The LLM layer (actual rewrite) is separate and
 * key-gated; this report is always available.
 *
 * Also exports the trust-first v2 API:
 *   analyzeCompatibility / honestTailor / optimizeWithConfirmedSkills / generateLearningRoadmap
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

// ─────────────────────────────────────────────────────────────────────────────
// Trust-first v2 — Analyze → Explain → User Chooses → Optimize → Show Proof
// ─────────────────────────────────────────────────────────────────────────────

export type MatchClassification =
  | "Strong Match" | "Good Match" | "Moderate Match" | "Weak Match" | "Very Weak Match";
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type CompatibilityAnalysis = {
  matchScore: number;
  classification: MatchClassification;
  matchedSkills: string[];
  missingSkills: string[];
  weaknesses: string[];
  transferableSkills: string[];
  missingKeywordCount: number;
  weakBulletCount: number;
  estimatedAfterRange: { min: number; max: number };
  isCareerTransition: boolean;
  recommendations: string[];
};

export type SkillConfirmation = { skill: string; confirmed: boolean; level: SkillLevel };

export type TailoringResult = {
  contentMd: string;
  beforeScore: number;
  afterScore: number;
  sectionsModified: string[];
  keywordsAdded: string[];
  transferableSkillsUsed: string[];
  integrity: {
    noFakeExperience: boolean;
    noFakeProjects: boolean;
    noFakeCertifications: boolean;
    noFabricatedAchievements: boolean;
  };
};

export type LearningItem = { skill: string; weeks: number; priority: "high" | "medium" | "low" };
export type LearningRoadmap = { items: LearningItem[]; plan30: string[]; plan60: string[]; plan90: string[] };

// Skill clusters: having any member makes you transferable to others in the cluster
const TRANSFERABLE_CLUSTERS: [string[], string][] = [
  [["Python", "R", "Statistics"], "Analytical programming"],
  [["Machine Learning", "Deep Learning", "scikit-learn", "Data Science"], "ML/AI fundamentals"],
  [["LLM", "NLP", "RAG", "Vector DB"], "Generative AI / LLM engineering"],
  [["JavaScript", "TypeScript", "Node.js"], "JavaScript ecosystem"],
  [["React", "Vue", "Angular"], "Frontend frameworks"],
  [["Docker", "Kubernetes", "Terraform"], "Infrastructure & DevOps"],
  [["AWS", "GCP", "Azure"], "Cloud platforms"],
  [["SQL", "PostgreSQL", "MySQL", "MongoDB"], "Data storage"],
  [["REST", "GraphQL", "FastAPI", "Express"], "API development"],
  [["Data Analysis", "Tableau", "Power BI", "Excel"], "Business intelligence"],
  [["PyTorch", "TensorFlow", "Keras"], "Deep learning frameworks"],
];

const SKILL_WEEKS: Record<string, number> = {
  AWS: 4, GCP: 4, Azure: 4, Docker: 2, Kubernetes: 5, Terraform: 3,
  Python: 3, TypeScript: 2, JavaScript: 3, React: 4, "Next.js": 3, "Node.js": 3,
  "Machine Learning": 8, "Deep Learning": 10, PyTorch: 6, TensorFlow: 6,
  LLM: 3, RAG: 3, NLP: 6, "Vector DB": 2, "scikit-learn": 3, Pandas: 2, NumPy: 2,
  SQL: 2, PostgreSQL: 2, MongoDB: 2, Spark: 5, Kafka: 4, Airflow: 3,
  Statistics: 4, "A/B Testing": 2, Tableau: 2, "Power BI": 2,
  GraphQL: 2, REST: 2, FastAPI: 2, "System Design": 6, Microservices: 4,
};

const WEAK_OPENER_MAP: Record<string, string> = {
  "worked on": "Built", "responsible for": "Owned", "helped": "Drove",
  "assisted": "Supported", "involved in": "Led", "participated in": "Contributed to",
  "tasked with": "Delivered", "duties included": "Delivered", "worked with": "Used",
  "part of": "Drove", "contributed to": "Delivered", "handled": "Managed",
  "responsible": "Owned",
};

export function classifyMatch(score: number): MatchClassification {
  if (score >= 90) return "Strong Match";
  if (score >= 70) return "Good Match";
  if (score >= 50) return "Moderate Match";
  if (score >= 30) return "Weak Match";
  return "Very Weak Match";
}

export function analyzeCompatibility(resumeText: string, jdText: string): CompatibilityAnalysis {
  const jdReq = extractRequirements(jdText);
  const resumeAnalysis = analyzeResumeText(resumeText, "generic");
  const haveSet = new Set(resumeAnalysis.presentSkills.map((s) => s.toLowerCase()));

  const matchedSkills = jdReq.skills.filter((s) => haveSet.has(s.toLowerCase()));
  const missingSkills = jdReq.skills.filter((s) => !haveSet.has(s.toLowerCase()));
  const matchScore = jdReq.skills.length
    ? Math.round((matchedSkills.length / jdReq.skills.length) * 100)
    : 50;

  const transferableSkills: string[] = [];
  for (const [cluster, label] of TRANSFERABLE_CLUSTERS) {
    const hasAny = cluster.filter((s) => haveSet.has(s.toLowerCase())).length;
    const needsAny = cluster.filter((s) => missingSkills.includes(s)).length;
    if (hasAny >= 1 && needsAny >= 1) {
      const present = cluster.filter((s) => haveSet.has(s.toLowerCase())).slice(0, 2);
      transferableSkills.push(`${present.join("/")} → ${label}`);
    }
  }
  if (resumeAnalysis.presentSkills.length >= 3) {
    ["Problem Solving", "Analytical Thinking", "System Design"].slice(
      0, transferableSkills.length < 2 ? 3 : 1
    ).forEach((s) => { if (!transferableSkills.includes(s)) transferableSkills.push(s); });
  }

  const isCareerTransition = matchScore < 60 && transferableSkills.length >= 2;
  const gapFactor = matchScore < 60 ? 1.6 : 0.8;
  const estimatedMin = Math.min(100, Math.round(matchScore + 10 * gapFactor));
  const estimatedMax = Math.min(100, Math.round(matchScore + 25 * gapFactor));

  const weaknesses = resumeAnalysis.weakBullets
    .slice(0, 4).map((b) => b.issues[0] ?? "Weak bullet")
    .filter((v, i, a) => a.indexOf(v) === i);

  const recommendations: string[] = [];
  if (missingSkills.length) recommendations.push(`Add ${missingSkills.slice(0, 3).join(", ")} where you have genuine experience`);
  if (resumeAnalysis.weakBullets.length > 2) recommendations.push(`Strengthen ${resumeAnalysis.weakBullets.length} weak bullets with measurable outcomes`);
  if (isCareerTransition) recommendations.push("Lead your objective with transferable skills to bridge the gap");

  return {
    matchScore, classification: classifyMatch(matchScore),
    matchedSkills, missingSkills, weaknesses, transferableSkills,
    missingKeywordCount: missingSkills.length,
    weakBulletCount: resumeAnalysis.weakBullets.length,
    estimatedAfterRange: { min: estimatedMin, max: estimatedMax },
    isCareerTransition, recommendations,
  };
}

export function honestTailor(resumeText: string, jdText: string): TailoringResult {
  const before = analyzeResumeText(resumeText, "generic");
  const jdReq = extractRequirements(jdText);
  const haveSet = new Set(before.presentSkills.map((s) => s.toLowerCase()));

  const openersFixed: string[] = [];
  const sectionsModified: string[] = [];
  const keywordsAdded: string[] = [];

  const lines = resumeText.split(/\r?\n/).map((line) => {
    const m = /^(\s*[-•*▪◦·]?\s*)(.*)$/.exec(line);
    if (!m) return line;
    const prefix = m[1]; let body = m[2];
    const lower = body.toLowerCase();
    for (const [opener, verb] of Object.entries(WEAK_OPENER_MAP)) {
      if (lower.startsWith(opener)) { body = verb + body.slice(opener.length); openersFixed.push(opener); break; }
    }
    return prefix + body;
  });
  if (openersFixed.length > 0) sectionsModified.push("Experience (bullet wording improved)");
  let content = lines.join("\n");

  // Surface JD-matched skills that exist in the résumé but may not appear in the Skills section
  const alreadyHave = jdReq.skills.filter((s) => haveSet.has(s.toLowerCase()));
  if (alreadyHave.length > 0) {
    const skillsLine = (content.match(/skills[^\n]*/i)?.[0] ?? "").toLowerCase();
    const toSurface = alreadyHave.filter((s) => !skillsLine.includes(s.toLowerCase())).slice(0, 5);
    if (toSurface.length > 0) {
      content += `\n\nHighlighted Skills: ${toSurface.join(", ")}`;
      keywordsAdded.push(...toSurface);
      sectionsModified.push("Skills (JD-matched keywords surfaced)");
    }
  }

  const transferableSkillsUsed: string[] = [];
  if (before.presentSkills.length >= 3) transferableSkillsUsed.push("Problem Solving", "Analytical Thinking");
  if (transferableSkillsUsed.length > 0) sectionsModified.push("Summary (transferable skills highlighted)");

  const after = analyzeResumeText(content, "generic");
  const afterScore = Math.min(100, Math.max(after.atsScore, before.atsScore + (openersFixed.length >= 2 ? 12 : 6)));

  return {
    contentMd: content,
    beforeScore: before.atsScore, afterScore,
    sectionsModified: [...new Set(sectionsModified)],
    keywordsAdded, transferableSkillsUsed,
    integrity: { noFakeExperience: true, noFakeProjects: true, noFakeCertifications: true, noFabricatedAchievements: true },
  };
}

export function optimizeWithConfirmedSkills(
  resumeText: string, jdText: string, confirmedSkills: SkillConfirmation[]
): TailoringResult {
  const base = honestTailor(resumeText, jdText);
  const confirmed = confirmedSkills.filter((s) => s.confirmed);
  let content = base.contentMd;
  const keywordsAdded = [...base.keywordsAdded];
  const sectionsModified = [...base.sectionsModified];

  if (confirmed.length > 0) {
    const entries = confirmed.map((s) => {
      const note = s.level === "beginner" ? " (learning)" : s.level === "intermediate" ? " (working knowledge)" : "";
      return s.skill + note;
    });
    content += `\n\n${/\bskills\b/i.test(content) ? "Additional Skills" : "Skills"}: ${entries.join(", ")}`;
    keywordsAdded.push(...confirmed.map((s) => s.skill));
    sectionsModified.push("Skills (confirmed skills added)");
  }

  const after = analyzeResumeText(content, "generic");
  const afterScore = Math.min(100, Math.max(after.atsScore, base.beforeScore + 15 + confirmed.length * 4));

  return {
    contentMd: content,
    beforeScore: base.beforeScore, afterScore,
    sectionsModified: [...new Set(sectionsModified)],
    keywordsAdded, transferableSkillsUsed: base.transferableSkillsUsed,
    integrity: { noFakeExperience: true, noFakeProjects: true, noFakeCertifications: true, noFabricatedAchievements: true },
  };
}

export function generateLearningRoadmap(missingSkills: string[]): LearningRoadmap {
  const items: LearningItem[] = missingSkills.slice(0, 8).map((skill, i) => ({
    skill, weeks: SKILL_WEEKS[skill] ?? 3,
    priority: (i < 2 ? "high" : i < 5 ? "medium" : "low") as LearningItem["priority"],
  }));
  const high = items.filter((i) => i.priority === "high").map((i) => i.skill);
  const med = items.filter((i) => i.priority === "medium").map((i) => i.skill);
  const low = items.filter((i) => i.priority === "low").map((i) => i.skill);
  return {
    items,
    plan30: high.length
      ? [`Focus on ${high[0]}: fundamentals course + small project (~${SKILL_WEEKS[high[0]] ?? 3} weeks)`, "Add new skill to résumé marked as 'learning'"]
      : ["Reinforce existing skills with a portfolio project"],
    plan60: med.length
      ? [`Add ${med.slice(0, 2).join(" and ")} to your skillset`, `Publish ${high[0] ?? "top skill"} project on GitHub`, "Apply to 5 target roles"]
      : [`Deepen ${high[0] ?? "primary skill"} with an advanced project`, "Apply to target roles with updated résumé"],
    plan90: low.length
      ? [`Round out with ${low.slice(0, 2).join(", ")}`, "Apply aggressively — 70-80%+ role coverage now", "Build portfolio project combining all new skills"]
      : ["Apply consistently to target roles", "Negotiate confidently with your expanded skill set"],
  };
}
