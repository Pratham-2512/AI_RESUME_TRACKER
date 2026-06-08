# 01 — System Architecture

## 1. High-level topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (browser)                              │
│  Next.js RSC pages + Client Components (shadcn/ui)  ·  Supabase JS (anon)  │
└───────────────┬──────────────────────────────────────────┬───────────────┘
                │ HTTPS (RSC payload / Server Actions)       │ realtime (WS)
                ▼                                            ▼
┌──────────────────────────────────────────┐   ┌───────────────────────────┐
│           VERCEL (Next.js server)         │   │       SUPABASE             │
│                                           │   │                           │
│  • RSC render + Server Actions            │──▶│  Postgres 15 + pgvector   │
│  • Route Handlers (/api/*)                │   │  Auth (GoTrue)            │
│  • Edge middleware (auth gate)            │   │  Storage (resume files)   │
│  • AI orchestration layer (lib/ai)        │   │  Realtime                 │
│  • Streaming (copilot, rewrite)           │   │  pg_cron + pgmq (queues)  │
└───────┬───────────────┬──────────────────┘   └───────────────────────────┘
        │               │
        ▼               ▼
┌───────────────┐  ┌──────────────────┐        ┌───────────────────────────┐
│ Anthropic API │  │ OpenAI Embeddings │        │  WORKER (Fly/Railway)      │
│ Opus 4.8 /    │  │ text-embedding-   │        │  • job scrapers            │
│ Haiku 4.5     │  │ 3-small           │        │  • Playwright form-fill    │
└───────────────┘  └──────────────────┘        │  • embedding backfill      │
                                                └───────────────────────────┘
```

**Design principle:** all secrets and all AI calls live server-side. The browser
holds only the Supabase **anon** key (scoped by RLS). The **service role** key and
`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` never leave Vercel server runtime or the worker.

## 2. Runtime boundaries

| Concern | Runs where | Auth context |
|---|---|---|
| Page render, reads | RSC on Vercel | user JWT → RLS |
| Mutations | Server Actions | user JWT → RLS |
| Long/streaming AI | Route Handlers (`/api/ai/*`) | user JWT → RLS |
| Cross-user/admin writes (scrape ingest, match backfill) | Worker / cron | service role (RLS bypass) |
| Browser automation | Self-hosted Playwright worker | per-run token |

**Why a separate worker?** Scraping, Playwright, and large embedding backfills exceed
Vercel function limits (CPU, 300s, memory) and need a persistent, non-serverless
process. Everything user-interactive stays on Vercel.

## 3. Core data flows

### 3.1 Resume upload → analysis (Module 2)

```
User uploads PDF/DOCX
  → Storage (private bucket: resumes/{user_id}/{uuid}.pdf)
  → Server Action inserts resumes row (status='parsing')
  → /api/ai/resume/parse:  Haiku 4.5 extracts structured JSON (sections, skills)
  → store parsed text + chunks; embed chunks (OpenAI) → resume_chunks.embedding
  → /api/ai/resume/analyze: Opus 4.8 computes ATS score + gaps + suggestions
  → resume_analyses row (before_score, breakdown JSON)
  → UI renders score + suggestions
```

### 3.2 Job discovery → matching (Modules 3, 4)

```
Worker scrapes job_sources → upsert jobs (dedup on (source, external_id))
  → embed job (title+description+skills) → jobs.embedding
User opens "Matches"
  → retrieve top-K jobs by cosine(profile_vector, jobs.embedding)  [pgvector]
  → for each candidate job: Opus 4.8 scores match (0-100) + strengths/gaps
  → cache in job_matches (keyed on profile_version + job_id)
  → UI renders ranked list
```

### 3.3 Copilot (Module 12)

```
User asks question in chat
  → /api/ai/copilot (streaming Route Handler)
  → build context: profile summary + recent applications + retrieved jobs/resume chunks (RAG)
  → Claude Opus 4.8 stream with tools (get_matches, get_skill_gap, draft_cover_letter)
  → tokens streamed to client; copilot_messages persisted on completion
```

## 4. Component layers (server code)

```
lib/
  supabase/        server & browser clients, typed DB
  ai/
    client.ts      Anthropic + OpenAI clients (server only)
    models.ts      model IDs + routing policy
    embeddings.ts  embed() / embedBatch()
    prompts/       one module per feature (system prompts + schemas)
    pipelines/     resume-analyze, job-match, skill-gap, interview-kit ...
  rag/             retrieval helpers (pgvector queries)
  domain/          pure business logic (scoring math, metrics)
```

The **AI orchestration layer** (`lib/ai`) is the only place that talks to Anthropic/
OpenAI. Routes and actions call pipelines; pipelines call prompts + clients. This keeps
model routing, retries, caching, and cost logging in one place (`ai_usage_log` table).

## 5. Caching strategy (summary)

| Cached thing | Where | Key | Invalidated when |
|---|---|---|---|
| Job embeddings | `jobs.embedding` | job id | job text changes |
| Resume chunk embeddings | `resume_chunks.embedding` | chunk id | resume re-parsed |
| Match scores | `job_matches` | (profile_version, job_id) | profile changes (version bump) |
| Anthropic prompt prefix | API-side prompt caching | stable system prompt | model/system change |
| Skill-gap report | `skill_gap_reports` | (user, day) | nightly recompute |

Profile edits bump `profiles.profile_version` (trigger). Match/analysis caches are keyed
on that version, so a profile change transparently invalidates derived AI results
without manual cache busting.

## 6. Non-functional targets (MVP)

- p95 page TTFB < 500ms (RSC, cached reads).
- Resume analysis end-to-end < 25s (parse + analyze, streamed progress).
- Match list for a user < 8s warm (scores cached), < 30s cold.
- Copilot first token < 2.5s.
- All tables RLS-enforced; zero cross-tenant reads possible with anon key.
