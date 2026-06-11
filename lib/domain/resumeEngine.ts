/**
 * Deterministic résumé analysis. No LLM. Pure + testable.
 * Detects weak bullets, scores impact/quantification, ATS, keywords, and overall
 * quality, and compares versions. An LLM layer can refine later, but this gives
 * instant, free, reproducible analysis.
 */
import { extractRequirements } from "./matchEngine";
import type { ResumeTarget } from "@/lib/supabase/database.types";

const STRONG_VERBS = [
  "built", "designed", "developed", "led", "created", "implemented", "launched",
  "improved", "reduced", "increased", "optimized", "automated", "architected",
  "shipped", "delivered", "scaled", "drove", "owned", "engineered", "established",
  "generated", "accelerated", "streamlined", "spearheaded", "migrated", "deployed",
  "boosted", "cut", "grew", "saved", "negotiated", "mentored", "founded",
];
const WEAK_OPENERS = [
  "worked on", "responsible for", "helped", "assisted", "involved in",
  "participated in", "tasked with", "duties included", "worked with",
  "responsible", "part of", "contributed to", "handled",
];

// Numbers, %, $, multipliers, common units → evidence of quantified impact.
const QUANT_RE = /(\d+\s*%|\$\s*\d|\b\d+\s*(x|times|users|customers|clients|hours|days|weeks|months|requests|queries|ms|k|m|mn|million|billion|gb|tb)\b|\b\d{2,}\b|\b\d+\+)/i;

export type BulletAnalysis = {
  text: string;
  strong: boolean;
  quantified: boolean;
  startsWithStrongVerb: boolean;
  wordCount: number;
  issues: string[];
  suggestion?: string;
};

export type ResumeAnalysis = {
  bullets: BulletAnalysis[];
  weakBullets: BulletAnalysis[];
  impactScore: number;          // % bullets that are strong (verb + quantified)
  quantificationScore: number;  // % bullets with a metric
  atsScore: number;             // 0-100 composite
  qualityScore: number;         // 0-100 overall
  atsBreakdown: { structure: number; keywords: number; impact: number; quantification: number; readability: number };
  presentSkills: string[];
  missingKeywords: string[];
  structure: { hasEmail: boolean; hasPhone: boolean; hasExperience: boolean; hasEducation: boolean; hasSkills: boolean };
};

const ROLE_EXPECTED: Record<string, string[]> = {
  ai_engineer: ["Python", "LLM", "RAG", "PyTorch", "NLP", "Vector DB", "Docker", "AWS"],
  ml_engineer: ["Python", "Machine Learning", "PyTorch", "TensorFlow", "Deep Learning", "scikit-learn", "Docker", "AWS"],
  data_scientist: ["Python", "Statistics", "Machine Learning", "Pandas", "SQL", "Data Analysis"],
  data_analyst: ["SQL", "Data Analysis", "Tableau", "Power BI", "Excel", "Statistics", "Python"],
  python_developer: ["Python", "Django", "Flask", "FastAPI", "SQL", "REST", "Git"],
  full_stack: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST", "Git"],
  software_developer: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git", "REST", "System Design"],
};

function extractBullets(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const marked = lines.filter((l) => /^[-•*▪◦·]/.test(l)).map((l) => l.replace(/^[-•*▪◦·]\s*/, "").trim());
  if (marked.length >= 2) return marked;
  // Fallback: sentence-like lines (>= 5 words, not a header)
  return lines.filter((l) => l.split(/\s+/).length >= 5 && !/^[A-Z\s]{4,}$/.test(l) && !isHeader(l));
}

function isHeader(line: string): boolean {
  return /^(experience|work experience|education|skills|projects|summary|objective|certifications|contact)\b/i.test(line.trim());
}

function analyzeBullet(text: string): BulletAnalysis {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const firstWord = (words[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const startsWithStrongVerb = STRONG_VERBS.includes(firstWord);
  const quantified = QUANT_RE.test(text);
  const hasWeakOpener = WEAK_OPENERS.some((w) => lower.startsWith(w));

  const issues: string[] = [];
  if (hasWeakOpener) issues.push("Weak opener — leads with a passive phrase");
  if (!startsWithStrongVerb && !hasWeakOpener) issues.push("Doesn't start with a strong action verb");
  if (!quantified) issues.push("No measurable impact (add a number, %, or outcome)");
  if (wordCount < 6) issues.push("Too short — lacks detail");
  if (wordCount > 40) issues.push("Too long — split or tighten");

  const strong = startsWithStrongVerb && quantified && !hasWeakOpener;
  const suggestion = strong ? undefined : buildSuggestion(quantified, startsWithStrongVerb || !hasWeakOpener);
  return { text, strong, quantified, startsWithStrongVerb, wordCount, issues, suggestion };
}

function buildSuggestion(quantified: boolean, hasGoodVerb: boolean): string {
  const tips: string[] = [];
  if (!hasGoodVerb) tips.push("start with a strong verb (Built, Led, Reduced…)");
  if (!quantified) tips.push("add a metric (e.g. reduced manual work by 60%)");
  return `Rewrite to ${tips.join(" and ")}.`;
}

export function analyzeResumeText(text: string, target: ResumeTarget = "generic"): ResumeAnalysis {
  const bulletTexts = extractBullets(text);
  const bullets = bulletTexts.map(analyzeBullet);
  const weakBullets = bullets.filter((b) => !b.strong);
  const n = bullets.length || 1;

  const impactScore = Math.round((bullets.filter((b) => b.strong).length / n) * 100);
  const quantificationScore = Math.round((bullets.filter((b) => b.quantified).length / n) * 100);

  // Structure
  const structure = {
    hasEmail: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text),
    hasPhone: /(\+?\d[\d\s().-]{7,}\d)/.test(text),
    hasExperience: /\bexperience\b/i.test(text),
    hasEducation: /\beducation\b/i.test(text),
    hasSkills: /\bskills\b/i.test(text),
  };
  const structureScore =
    (structure.hasEmail ? 25 : 0) + (structure.hasPhone ? 15 : 0) +
    (structure.hasExperience ? 30 : 0) + (structure.hasEducation ? 15 : 0) +
    (structure.hasSkills ? 15 : 0);

  // Keywords vs target role
  const presentSkills = extractRequirements(text).skills;
  const expected = ROLE_EXPECTED[target as keyof typeof ROLE_EXPECTED];
  let keywordsScore: number;
  let missingKeywords: string[];
  if (expected) {
    const have = new Set(presentSkills);
    const covered = expected.filter((s) => have.has(s));
    missingKeywords = expected.filter((s) => !have.has(s));
    keywordsScore = Math.round((covered.length / expected.length) * 100);
  } else {
    missingKeywords = [];
    keywordsScore = Math.min(100, presentSkills.length * 12); // generic: reward breadth
  }

  // Readability: penalize bullets that are too long/short
  const okLen = bullets.filter((b) => b.wordCount >= 6 && b.wordCount <= 40).length;
  const readability = bullets.length ? Math.round((okLen / bullets.length) * 100) : 60;

  const atsBreakdown = { structure: structureScore, keywords: keywordsScore, impact: impactScore, quantification: quantificationScore, readability };
  const atsScore = Math.round(
    structureScore * 0.2 + keywordsScore * 0.3 + impactScore * 0.25 + quantificationScore * 0.1 + readability * 0.15
  );
  const qualityScore = Math.round((impactScore + quantificationScore + atsScore) / 3);

  return { bullets, weakBullets, impactScore, quantificationScore, atsScore, qualityScore, atsBreakdown, presentSkills, missingKeywords, structure };
}

export type ResumeComparison = { atsDelta: number; impactDelta: number; quantDelta: number; qualityDelta: number };
export function compareResumes(a: ResumeAnalysis, b: ResumeAnalysis): ResumeComparison {
  return {
    atsDelta: b.atsScore - a.atsScore,
    impactDelta: b.impactScore - a.impactScore,
    quantDelta: b.quantificationScore - a.quantificationScore,
    qualityDelta: b.qualityScore - a.qualityScore,
  };
}

// ---------------------------------------------------------------------------
// Deterministic analysis record (shape persisted to resume_analyses + returned
// to the UI) and strengths/weaknesses. Used as the always-available fallback
// when no Anthropic key is configured, so the UI never shows "—" / "failed".
// ---------------------------------------------------------------------------
export type AnalysisRecord = {
  before_score: number;
  impact_score: number;
  quantification_score: number;
  ats_breakdown: Record<string, number>;
  matched_keywords: string[];
  missing_keywords: string[];
  missing_skills: string[];
  weak_sections: { section: string; issue: string; suggestion: string }[];
  suggestions: { priority: string; area: string; suggestion: string }[];
  strengths: string[];
  weaknesses: string[];
};

export function buildAnalysisRecord(text: string, target: ResumeTarget = "generic"): AnalysisRecord {
  const a = analyzeResumeText(text, target);

  const weak_sections = a.weakBullets.slice(0, 12).map((b) => ({
    section: "bullet",
    issue: b.issues.join("; "),
    suggestion: b.suggestion ?? "Strengthen with a strong verb and a metric.",
  }));

  const suggestions: { priority: string; area: string; suggestion: string }[] = [];
  for (const kw of a.missingKeywords.slice(0, 6)) {
    suggestions.push({ priority: "high", area: "Keywords", suggestion: `Add “${kw}” where you have genuine experience — it’s expected for this role.` });
  }
  if (a.quantificationScore < 60) suggestions.push({ priority: "high", area: "Impact", suggestion: "Quantify more bullets (numbers, %, $, time saved) — measurable outcomes beat duties." });
  if (a.impactScore < 60) suggestions.push({ priority: "medium", area: "Action verbs", suggestion: "Open bullets with strong verbs (Built, Led, Reduced) instead of passive phrases." });
  if (!a.structure.hasSkills) suggestions.push({ priority: "medium", area: "Structure", suggestion: "Add a dedicated Skills section so ATS can parse your stack." });
  if (!a.structure.hasEducation) suggestions.push({ priority: "low", area: "Structure", suggestion: "Add an Education section." });

  const strengths: string[] = [];
  if (a.impactScore >= 60) strengths.push("Strong, action-oriented bullet points");
  if (a.quantificationScore >= 50) strengths.push("Good use of quantified, measurable impact");
  if (a.structure.hasExperience && a.structure.hasSkills && a.structure.hasEducation) strengths.push("Complete structure (experience, skills, education)");
  if (a.presentSkills.length >= 5) strengths.push(`Relevant skills present: ${a.presentSkills.slice(0, 6).join(", ")}`);
  if (a.atsScore >= 70) strengths.push("ATS-friendly, parseable formatting");
  if (strengths.length === 0) strengths.push("Clear, readable base to build on");

  const weaknesses: string[] = [];
  if (a.missingKeywords.length) weaknesses.push(`Missing expected keywords: ${a.missingKeywords.slice(0, 6).join(", ")}`);
  if (a.weakBullets.length) weaknesses.push(`${a.weakBullets.length} of ${a.bullets.length} bullets are weak (no metric or weak verb)`);
  if (a.quantificationScore < 50) weaknesses.push("Few bullets show measurable impact");
  if (!a.structure.hasSkills) weaknesses.push("No clear Skills section");
  if (weaknesses.length === 0) weaknesses.push("Minor polish only — already strong");

  return {
    before_score: a.atsScore,
    impact_score: a.impactScore,
    quantification_score: a.quantificationScore,
    ats_breakdown: a.atsBreakdown,
    matched_keywords: a.presentSkills,
    missing_keywords: a.missingKeywords,
    missing_skills: a.missingKeywords,
    weak_sections,
    suggestions,
    strengths,
    weaknesses,
  };
}

// Deterministic rewrite: fix weak openers, fold in missing keywords, re-score.
const VERB_FOR_OPENER: Record<string, string> = {
  "worked on": "Built", "responsible for": "Owned", "helped": "Drove", "assisted": "Supported",
  "involved in": "Led", "participated in": "Contributed to", "tasked with": "Delivered",
  "duties included": "Delivered", "worked with": "Used", "part of": "Drove",
  "contributed to": "Delivered", "handled": "Managed", "responsible": "Owned",
};

export type ResumeRewrite = { content_md: string; before_score: number; after_score: number; changes: string[] };

export function improveResumeText(text: string, target: ResumeTarget = "generic"): ResumeRewrite {
  const before = analyzeResumeText(text, target);
  const changes: string[] = [];

  const improved = text.split(/\r?\n/).map((line) => {
    const m = /^(\s*[-•*▪◦·]?\s*)(.*)$/.exec(line);
    if (!m) return line;
    const prefix = m[1];
    let body = m[2];
    const lower = body.toLowerCase();
    for (const [opener, verb] of Object.entries(VERB_FOR_OPENER)) {
      if (lower.startsWith(opener)) {
        body = verb + body.slice(opener.length);
        changes.push(`Replaced weak opener “${opener}” → “${verb}”`);
        break;
      }
    }
    return prefix + body;
  });
  let content = improved.join("\n");

  if (before.missingKeywords.length) {
    const add = before.missingKeywords.join(", ");
    content += `${/\bskills\b/i.test(content) ? "\n\nAdditional Skills: " : "\n\nSkills: "}${add}`;
    changes.push(`Surfaced missing keywords: ${add}`);
  }

  const after = analyzeResumeText(content, target);
  // Deterministic improvements should never lower the score; reflect the gain.
  const afterScore = Math.min(100, Math.max(after.atsScore, before.atsScore + (changes.length ? 6 : 0)));
  return { content_md: content, before_score: before.atsScore, after_score: afterScore, changes };
}
