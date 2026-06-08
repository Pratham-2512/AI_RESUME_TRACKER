# 08 — AI Prompt Architecture

All AI calls go through `lib/ai`. This doc defines model routing, shared request
conventions, and per-feature prompts + structured-output schemas.

## 1. Model routing policy (`lib/ai/models.ts`)

| Feature | Model | Why |
|---|---|---|
| Resume parse (text → JSON) | `claude-haiku-4-5` | high volume, mechanical extraction |
| Job classification / skill tagging on ingest | `claude-haiku-4-5` | bulk, cheap |
| Resume analyze (ATS score, gaps) | `claude-opus-4-8` | judgment, calibrated scoring |
| Resume rewrite | `claude-opus-4-8` | quality-critical, user-facing |
| Job match scoring | `claude-opus-4-8` | reasoning over fit |
| Skill-gap roadmap | `claude-opus-4-8` | synthesis + ROI ranking |
| Cover letters / emails / LinkedIn | `claude-opus-4-8` | writing quality |
| Interview kit | `claude-opus-4-8` | grounded, high-quality Q&A |
| Copilot | `claude-opus-4-8` | agentic, tool use |
| Embeddings | OpenAI `text-embedding-3-small` | Anthropic has no embeddings API |

> Routing is centralized so a single edit re-tiers a feature. Downgrade to
> `claude-haiku-4-5` only after measuring quality on an eval set.

## 2. Request conventions (non-negotiable on Opus 4.8)

```ts
// lib/ai/client.ts
import Anthropic from "@anthropic-ai/sdk";
export const anthropic = new Anthropic(); // ANTHROPIC_API_KEY from env, server only

// Standard call shape:
const res = await anthropic.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 16000,                       // stream if you need > ~16k
  thinking: { type: "adaptive" },          // NEVER budget_tokens (400 on 4.8)
  output_config: { effort: "high" },       // low|medium|high|xhigh|max
  system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
  messages,
});
```

Hard rules (from the Anthropic API surface for Opus 4.8):
- **No** `temperature` / `top_p` / `top_k` → 400. Steer via prompt.
- **No** `budget_tokens` → 400. Use `thinking: {type:"adaptive"}`.
- **No** last-assistant-turn prefill → 400. Use structured outputs instead.
- For structured JSON use `output_config.format` (json_schema) or
  `client.messages.parse()` — never prefill `{`.
- Stream (`messages.stream()` + `.finalMessage()`) for rewrite/copilot/interview kits.

## 3. Prompt caching

Each feature has a **frozen** system prompt (the rubric/instructions) marked
`cache_control: {type:"ephemeral"}`. Volatile content (this user's profile, this job)
goes in the `messages` turn, after the cached prefix. This keeps the rubric cached across
all users hitting the same feature. Never interpolate dates/IDs into the system prompt.

## 4. Structured outputs

Features that persist to typed columns use `messages.parse()` with a Zod schema
(`zodOutputFormat`). The schema doubles as the API contract in `docs/04`. JSON-schema
limits apply (no min/max, no recursion — SDK strips & client-validates).

---

## 5. Per-feature specs

Each block: **system prompt intent → user-turn context → output schema → model/effort.**

### 5.1 Resume parse — Haiku
- **System:** "You extract structured data from resume text. Return only fields present;
  do not invent. Normalize skill names."
- **User turn:** raw `parsed_text`.
- **Schema:** `{ contact, summary, experience[], education[], skills[], projects[], certifications[] }`.
- **Model:** `claude-haiku-4-5`, effort omitted (Haiku has no effort), `max_tokens 8000`.

### 5.2 Resume analyze (ATS) — Opus
- **System (cached):** the ATS rubric — scoring dimensions and weights:
  `formatting(15) · keyword_coverage(30) · quantified_impact(25) · relevance(20) ·
  readability(10)`; how to detect weak sections; how to pick missing keywords from a job
  if `jobId` provided, else from `target` role norms.
- **User turn:** resume text + (optional) job description + target role.
- **Schema:** see `docs/04` analyze schema (`before_score`, `ats_breakdown`,
  `matched/missing_keywords`, `missing_skills`, `weak_sections[]`, `suggestions[]`).
- **Model:** `claude-opus-4-8`, `effort: "high"`.

### 5.3 Resume rewrite — Opus (stream)
- **System (cached):** "Rewrite to maximize ATS score for `{target}` without fabricating
  experience. Use strong action verbs, quantify impact, mirror role keywords, keep it
  truthful and single-column ATS-safe. Output markdown resume + a short change log."
- **User turn:** original resume + analyze result (so it fixes the named weaknesses) +
  target.
- **Output:** markdown body + `after_score` (self-scored against the same rubric) +
  `changes[]`. Persisted to `resume_versions`.
- **Model:** `claude-opus-4-8`, `effort: "high"`, streamed.

### 5.4 Job match scoring — Opus (batched)
- **System (cached):** "Score candidate→job fit 0–100. Weigh required skills, experience
  level, domain. List concrete strengths, missing skills, weak areas, one-paragraph
  rationale. Be calibrated: 85+ only for strong fits."
- **User turn:** profile summary (skills, years, roles) + one or a small batch of jobs.
- **Schema:** `{ matches: [{ job_id, match_score, skill_match_pct, strengths[],
  missing_skills[], weak_areas[], rationale }] }`.
- **Model:** `claude-opus-4-8`, `effort: "medium"` (volume control), batch ~5 jobs/call.
- Cached in `job_matches` on `(user_id, job_id, profile_version)`.

### 5.5 Skill-gap roadmap — Opus
- SQL pre-aggregates `most_requested` / `missing_frequency` over matched jobs.
- **System (cached):** "Given the user's missing-skill frequencies and current skills,
  produce a 4-week roadmap. Rank skills by ROI = market_demand × gap_severity ÷
  learning_effort. Each week: focus, skills, concrete free/paid resources, a checkpoint."
- **Schema:** `{ weeks: [{ week, focus, skills[], resources[], roi_note }] }`.
- **Model:** `claude-opus-4-8`, `effort: "high"`.

### 5.6 Cover letter / emails — Opus (stream)
- **System (cached):** persona = expert career writer; constraints: ≤ 300 words, specific
  to the job, no clichés, mirror 2–3 job keywords, `{tone}`.
- **User turn:** profile summary + job description + (optional) resume highlights.
- **Output:** plain text body. Persisted to `generated_documents`.
- Variants by `type`: recruiter_message (≤ 80 words), hiring_manager_email (subject +
  body), followup_email (references prior contact).

### 5.7 LinkedIn assistant — Opus
- One system prompt per sub-type (headline / about / post / project post / connect msg),
  all sharing the brand-voice preamble. Posts include a hook + 3 takeaways + CTA;
  headlines ≤ 220 chars; connect messages ≤ 300 chars.

### 5.8 Interview kit — Opus (stream)
- **System (cached):** "Generate interview questions grounded in the job + candidate.
  Cover technical, HR, behavioral, project. For each: a suggested answer using the STAR
  method drawn from the candidate's real experience, a difficulty, and a confidence
  rating (how well the candidate's background supports a strong answer)."
- **Schema:** `{ questions: [{ kind, difficulty, question, suggested_answer, confidence }] }`.
- **Model:** `claude-opus-4-8`, `effort: "high"`.

### 5.9 Copilot — Opus (stream + tools)
- **System (cached):** career-coach persona; describe available tools and *when* to call
  them (prescriptive — recent Opus reaches for tools conservatively).
- **Tools (client-executed, RLS-scoped):**
  - `get_matches({limit})` → top job matches.
  - `get_skill_gap()` → latest report.
  - `draft_document({type, jobId})` → calls 5.6/5.7 pipeline.
  - `explain_rejections()` → aggregates rejected applications + resume gaps.
- **Context build (RAG):** profile summary + recent applications + retrieved resume/job
  chunks (see `docs/09`). Injected as a `messages` turn, not the cached system prompt.
- **Model:** `claude-opus-4-8`, `effort: "high"`, streamed via SSE; persist messages +
  token counts.

## 6. Cost logging

Every pipeline wraps the call and writes `ai_usage_log` (`feature`, `model`, tokens,
`cache_read`, computed `cost_usd`, `latency_ms`). This is the source of truth for
`docs/12` and Copilot budget answers.

## 7. Safety / grounding

- Rewrite and interview prompts forbid fabricating experience; they may only rephrase /
  quantify what the profile contains.
- All generated docs are drafts shown for user edit before use.
- Handle `stop_reason: "refusal"` and `"max_tokens"` explicitly in `lib/ai`.
