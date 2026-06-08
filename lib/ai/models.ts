/**
 * Central model routing. Edit here to re-tier a feature.
 * Policy (docs/08): Opus 4.8 for judgment/writing; Haiku 4.5 for bulk extraction.
 */
export const MODELS = {
  reasoning: "claude-opus-4-8",
  cheap: "claude-haiku-4-5",
  embedding: "text-embedding-3-small", // OpenAI; 1536 dims
} as const;

export type AiFeature =
  | "resume_parse"
  | "resume_analyze"
  | "resume_rewrite"
  | "job_embed"
  | "job_match"
  | "skill_gap"
  | "cover_letter"
  | "interview_kit"
  | "linkedin"
  | "copilot";

/** Per-feature model + effort. Effort applies to Opus only. */
export const FEATURE_CONFIG: Record<
  AiFeature,
  { model: string; effort?: "low" | "medium" | "high" | "xhigh" | "max" }
> = {
  resume_parse: { model: MODELS.cheap },
  resume_analyze: { model: MODELS.reasoning, effort: "high" },
  resume_rewrite: { model: MODELS.reasoning, effort: "high" },
  job_embed: { model: MODELS.embedding },
  job_match: { model: MODELS.reasoning, effort: "medium" },
  skill_gap: { model: MODELS.reasoning, effort: "high" },
  cover_letter: { model: MODELS.reasoning, effort: "high" },
  interview_kit: { model: MODELS.reasoning, effort: "high" },
  linkedin: { model: MODELS.reasoning, effort: "medium" },
  copilot: { model: MODELS.reasoning, effort: "high" },
};

/** Pricing per 1M tokens (USD) for ai_usage_log cost calc. */
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};

export function costUsd(model: string, tokensIn: number, tokensOut: number) {
  const p = PRICING[model] ?? { in: 0, out: 0 };
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
}
