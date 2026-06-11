/**
 * Deterministic cover-letter generator. No LLM — composes a tight, specific
 * letter from the candidate's real profile/résumé and the job description
 * (via the same requirement-extraction the match engine uses). An LLM layer
 * can refine later; this is always available and instant.
 */
import { extractRequirements } from "./matchEngine";

export type CoverLetterInput = {
  fullName?: string | null;
  headline?: string | null;
  yearsExperience?: number | null;
  resumeText: string;
  jobTitle: string;
  company?: string | null;
  jdText: string;
};

export type CoverLetterResult = {
  title: string;
  content: string;
  matchedSkills: string[];
  highlights: string[];
};

const QUANT_RE = /(\d+\s*%|\$\s*\d|\b\d+\s*(x|times|users|customers|clients|hours|days|weeks|months|requests|queries|ms|k|m|million|billion)\b|\b\d{2,}\b)/i;

/** Pull the strongest (quantified) bullets from the résumé as proof points. */
function bestBullets(resumeText: string, matched: string[]): string[] {
  const lines = resumeText.split(/\r?\n/).map((l) => l.replace(/^[-•*▪◦·]\s*/, "").trim()).filter(Boolean);
  const candidates = lines.filter((l) => l.split(/\s+/).length >= 6 && QUANT_RE.test(l));
  // Prefer bullets that mention a matched skill.
  const scored = candidates
    .map((text) => ({ text, hits: matched.filter((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)).length }))
    .sort((a, b) => b.hits - a.hits);
  return scored.slice(0, 3).map((s) => s.text.replace(/[.;,]\s*$/, ""));
}

export function generateCoverLetter(input: CoverLetterInput): CoverLetterResult {
  const req = extractRequirements(input.jdText);
  const have = new Set(extractRequirements(input.resumeText).skills.map((s) => s.toLowerCase()));
  const matched = req.skills.filter((s) => have.has(s.toLowerCase()));
  const highlights = bestBullets(input.resumeText, matched);

  const name = input.fullName?.trim() || "Candidate";
  const company = input.company?.trim() || "your team";
  const role = input.jobTitle.trim() || "the role";
  const years = input.yearsExperience != null && input.yearsExperience > 0 ? `${input.yearsExperience}+ years of experience` : "hands-on experience";
  const skillLine = matched.length
    ? matched.slice(0, 5).join(", ")
    : "modern engineering practices";

  const proof = highlights.length
    ? `A few results I'm proud of:\n${highlights.map((h) => `• ${h}.`).join("\n")}\n\n`
    : "";

  const headline = input.headline?.trim() ? ` as a ${input.headline.trim()}` : "";

  const content = `Dear Hiring Manager,

I'm writing to apply for the ${role} position at ${company}. With ${years}${headline}, I bring exactly the stack this role calls for — ${skillLine} — and a track record of shipping measurable results.

${proof}What draws me to this opening is the overlap between what you need and what I've already delivered: my background maps directly onto ${matched.length ? `${matched.length} of the core requirements (${matched.slice(0, 4).join(", ")})` : "the core requirements in the description"}, so I can contribute from week one rather than ramping for months.

I'd welcome the chance to talk about how I can help ${company} hit its goals. Thank you for your time and consideration.

Best regards,
${name}`;

  return {
    title: `Cover letter — ${role}${input.company ? ` @ ${input.company}` : ""}`,
    content,
    matchedSkills: matched,
    highlights,
  };
}

/** Application checklist for the Apply Assistant (safe, no automation). */
export type ChecklistItem = { id: string; label: string; detail?: string };

export function buildApplicationChecklist(opts: { hasTailoredResume: boolean; hasCoverLetter: boolean; company?: string | null }): ChecklistItem[] {
  return [
    { id: "resume", label: opts.hasTailoredResume ? "Tailored résumé ready" : "Tailor your résumé to this job", detail: "Use the tailored version, not the generic one." },
    { id: "letter", label: opts.hasCoverLetter ? "Cover letter ready" : "Generate your cover letter", detail: "Personalize the first line if you know the hiring manager." },
    { id: "keywords", label: "Mirror the job's exact keywords", detail: "ATS filters match literal strings — use their wording." },
    { id: "apply", label: "Submit on the official posting", detail: "Apply via the original link; avoid easy-apply when a direct portal exists." },
    { id: "track", label: "Track it in your pipeline", detail: `Log the application${opts.company ? ` to ${opts.company}` : ""} so follow-ups don't slip.` },
    { id: "followup", label: "Set a 7-day follow-up", detail: "A short, polite nudge doubles response rates." },
  ];
}
