import { z } from "zod";

/* ---------------- PARSE (Haiku) ---------------- */
export const parseSchema = z.object({
  contact: z.object({
    name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable(),
    location: z.string().nullable(),
  }),
  summary: z.string().nullable(),
  skills: z.array(z.string()),
  experience: z.array(z.object({
    title: z.string(), company: z.string(),
    start_date: z.string().nullable(), end_date: z.string().nullable(),
    highlights: z.array(z.string()),
  })),
  education: z.array(z.object({
    school: z.string(), degree: z.string().nullable(), field: z.string().nullable(),
  })),
  projects: z.array(z.object({ name: z.string(), description: z.string().nullable() })),
  certifications: z.array(z.string()),
});
export type ParsedResume = z.infer<typeof parseSchema>;

export const PARSE_SYSTEM = `You extract structured data from resume text.
Return ONLY valid JSON matching the requested shape. Rules:
- Do not invent information that isn't present; use null / empty arrays when unknown.
- Normalize skill names (e.g. "ReactJS" -> "React").
- Keep experience highlights as concise bullet strings.`;

/* ---------------- ANALYZE (Opus) ---------------- */
export const analyzeSchema = z.object({
  before_score: z.number().min(0).max(100),
  ats_breakdown: z.object({
    formatting: z.number(), keywords: z.number(), impact: z.number(),
    relevance: z.number(), readability: z.number(),
  }),
  matched_keywords: z.array(z.string()),
  missing_keywords: z.array(z.string()),
  missing_skills: z.array(z.string()),
  weak_sections: z.array(z.object({
    section: z.string(), issue: z.string(), suggestion: z.string(),
  })),
  suggestions: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]), area: z.string(), suggestion: z.string(),
  })),
});
export type ResumeAnalysis = z.infer<typeof analyzeSchema>;

export const ANALYZE_SYSTEM = `You are an expert ATS (Applicant Tracking System) and resume reviewer.
Score the resume and return ONLY valid JSON matching the requested shape.

Scoring rubric (weights):
- formatting (15): single-column, ATS-safe, consistent, no tables/images that break parsing.
- keywords (30): coverage of role-relevant keywords (from the target role, or the job description if provided).
- impact (25): quantified achievements, strong action verbs, outcomes not duties.
- relevance (20): alignment of experience/skills to the target role.
- readability (10): clarity, concision, no filler.

Each sub-score is 0-100; before_score is their weighted average, rounded.
- matched_keywords / missing_keywords: relative to the target role (or job description if given).
- missing_skills: concrete skills the candidate lacks for the target.
- weak_sections: specific sections with a concrete issue + fix.
- suggestions: prioritized, actionable improvements.
Be calibrated: a strong, well-targeted resume scores 80+; a generic one scores 50-65.`;

export function analyzeUser(opts: { resumeText: string; target: string; jobDescription?: string }) {
  return [
    `Target role profile: ${opts.target}`,
    opts.jobDescription ? `Job description to optimize against:\n${opts.jobDescription}` : null,
    `Resume text:\n${opts.resumeText}`,
  ].filter(Boolean).join("\n\n");
}

/* ---------------- REWRITE (Opus) ---------------- */
export const REWRITE_SYSTEM = `You are an expert resume writer optimizing for ATS and the target role.
Return ONLY valid JSON: { "content_md": string, "after_score": number, "changes": string[] }.

Rules:
- NEVER fabricate experience, employers, dates, or credentials. Only rephrase, quantify,
  reorganize, and surface keywords the candidate genuinely has.
- Use strong action verbs and quantified impact.
- Single-column, ATS-safe markdown. Mirror the target role's important keywords.
- after_score: your honest ATS score (0-100) of the rewritten resume using the same rubric.
- changes: short bullet list of what you improved and why.`;

export const rewriteSchema = z.object({
  content_md: z.string(),
  after_score: z.number().min(0).max(100),
  changes: z.array(z.string()),
});
export type RewriteResult = z.infer<typeof rewriteSchema>;

export function rewriteUser(opts: { resumeText: string; target: string; analysis?: unknown }) {
  return [
    `Target role: ${opts.target}`,
    opts.analysis ? `Known weaknesses to fix (from prior analysis):\n${JSON.stringify(opts.analysis)}` : null,
    `Original resume text:\n${opts.resumeText}`,
  ].filter(Boolean).join("\n\n");
}
