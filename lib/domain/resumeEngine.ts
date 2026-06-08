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
