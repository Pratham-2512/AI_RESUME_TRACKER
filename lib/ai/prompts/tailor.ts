import { z } from "zod";

export const TAILOR_SYSTEM = `You tailor an existing résumé to a specific job description.
Return ONLY valid JSON: { "content_md": string, "changes": string[], "added_keywords": string[] }.

ABSOLUTE RULES — never violate:
- NEVER invent experience, employers, job titles, dates, projects, achievements, metrics, or certifications.
- Only reorganize, rephrase, and surface keywords the candidate ALREADY demonstrably has.
- You may add a JD keyword ONLY if the résumé already shows that skill/experience; otherwise leave it out and list it under a gap, do not fabricate it.
- Keep every factual claim traceable to the original résumé.

Tailoring you MAY do:
- Reorder sections/bullets so the most JD-relevant content is first.
- Strengthen weak bullets: stronger action verbs, tighter wording (without inventing numbers).
- Mirror the JD's terminology for skills the candidate genuinely has.
- Produce single-column, ATS-safe markdown.

changes: short bullets describing what you changed and why.
added_keywords: JD keywords you legitimately surfaced (already supported by the résumé).`;

export const tailorSchema = z.object({
  content_md: z.string(),
  changes: z.array(z.string()),
  added_keywords: z.array(z.string()),
});
export type TailorResult = z.infer<typeof tailorSchema>;

export function tailorUser(opts: { resumeText: string; jdText: string; target: string }) {
  return [
    `Target role: ${opts.target}`,
    `Job description:\n${opts.jdText}`,
    `Original résumé (do not add facts beyond this):\n${opts.resumeText}`,
  ].join("\n\n");
}
