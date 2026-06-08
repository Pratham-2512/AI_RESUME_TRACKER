# 03 — Database Schema

Runnable DDL: [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql).
This doc explains the model, relationships, RLS rationale, and storage design.

## 1. Entity map

```
auth.users (Supabase)
   └─1:1─ profiles ──┬─1:N─ education
                     ├─1:N─ experience
                     ├─1:N─ skills
                     ├─1:N─ certifications
                     ├─1:N─ projects
                     ├─1:N─ career_goals
                     ├─1:N─ resumes ──┬─1:N─ resume_versions
                     │                ├─1:N─ resume_analyses
                     │                └─1:N─ resume_chunks (vector)
                     ├─1:N─ saved_jobs ─────────┐
                     ├─1:N─ job_matches ────────┤
                     ├─1:N─ generated_documents ┤
                     ├─1:N─ interview_kits ─1:N─ interview_questions
                     ├─1:N─ applications ─1:N─ application_events
                     ├─1:N─ application_runs ─1:N─ application_run_steps
                     ├─1:N─ skill_gap_reports ─1:N─ learning_roadmaps
                     └─1:N─ copilot_threads ─1:N─ copilot_messages

jobs (GLOBAL, shared)  ◀── saved_jobs / job_matches / applications / runs reference it
job_sources (GLOBAL)
ai_usage_log (per-user cost log)
```

## 2. Ownership & tenancy

Two tenancy classes:

1. **Per-user (private):** everything hanging off `profiles`. Owner column is `user_id`
   (`id` on `profiles` itself). RLS: `auth.uid() = user_id`.
2. **Global (shared read):** `jobs`, `job_sources`. Any authenticated user can `SELECT`;
   only the **service role** (worker/cron) may write. There is no insert/update policy,
   so anon/auth writes are denied by default-deny RLS.

`applications` keeps a **snapshot** of `job_title`/`company` so a user's history survives
even if the global `jobs` row is later pruned (`job_id` FK is `on delete set null`).

## 3. Why these specific design choices

| Decision | Rationale |
|---|---|
| `profiles.id = auth.users.id` | 1:1 with auth; no join to resolve identity; trigger auto-creates on signup. |
| `profile_version` + trigger | Single integer cache key. Editing skills/exp/edu/projects bumps it; `job_matches` and analyses are keyed on it, so AI caches self-invalidate. |
| `jobs` global, not per-user | One job scraped once, matched by N users. Avoids N copies + N embeds. |
| `job_matches` unique `(user_id, job_id, profile_version)` | Idempotent caching; recompute only when profile changes. |
| `resume_versions` immutable, numbered | Module 2 needs before/after + multiple targets (ATS, ML, etc.) without mutating the original. |
| `application_events` via trigger | Free, reliable funnel timeline for dashboard metrics — no app code needed. |
| `application_runs.approved_at` | Module 10's hard gate: submission code asserts this is non-null. |
| `embedding vector(1536)` | Matches OpenAI `text-embedding-3-small`. HNSW + cosine for ANN. |
| `ai_usage_log` | Per-call cost/latency telemetry → powers Module 12 budgeting & the cost model. |

## 4. Vector / RAG columns

- `jobs.embedding` — embed of `title + company + description + skills`.
- `resume_chunks.embedding` — ~500-token chunks of resume text.
- `profiles.embedding` — embed of the synthesized profile summary; used as the query
  vector in `match_jobs()`.

ANN indexes are **HNSW** (`vector_cosine_ops`) — better recall/latency than IVFFlat for
this scale and no `lists` tuning. Retrieval helper is the `match_jobs()` SQL function
(see migration); it's `stable` and respects type/mode filters before the ORDER BY.

## 5. RLS model (summary)

- RLS **enabled on every table**; default deny.
- Per-user tables get 4 policies (select/insert/update/delete) all gated on
  `auth.uid() = user_id`. Generated programmatically in the migration's `DO` loop.
- `jobs`/`job_sources`: read-only for authenticated; writes require service role.
- Storage bucket `resumes` is **private**; object policy restricts each user to their own
  `{user_id}/` prefix.
- Server Actions/route handlers use the **user-scoped** Supabase client (RLS applies).
  Only worker/cron uses the **service-role** client (RLS bypassed) and must filter
  manually. See `docs/11-security.md`.

## 6. Storage design

```
bucket: resumes (private)
  resumes/{user_id}/{resume_uuid}.pdf        # original upload
  resumes/{user_id}/{resume_uuid}.docx
generated artifacts (resume rewrites, cover letters) are stored as TEXT in Postgres,
not files — they're rendered to PDF client-side or via an export route on demand.
```

Signed URLs (60s TTL) are minted server-side for download; the raw bucket is never public.

## 7. Migrations convention

- `0001_initial_schema.sql` — this file.
- `0002_*`, `0003_*` … additive only; never edit a shipped migration.
- Seed data (e.g. `job_sources`) lives in `supabase/seed.sql`.
- Generate types after each change: `supabase gen types typescript --local > lib/supabase/database.types.ts`.
