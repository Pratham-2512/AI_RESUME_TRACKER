# AI Career OS

An AI-powered career operating system: job discovery, resume intelligence, AI job
matching, skill-gap analysis, application materials, interview prep, application
tracking, a LinkedIn assistant, a semi-automated application flow, and an AI career
copilot.

This repository is the **implementation-ready technical specification**. Every document
under `docs/` is written to be coded against directly. The SQL under
`supabase/migrations/` is runnable as-is.

---

## Tech stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | RSC + Server Actions + Route Handlers |
| Language | TypeScript (strict) | |
| UI | Tailwind CSS + shadcn/ui | Radix primitives |
| DB | Supabase Postgres 15 + `pgvector` | RLS on every table |
| Auth | Supabase Auth | email/password + Google OAuth + magic link |
| Storage | Supabase Storage | resume files (private bucket) |
| Generation LLM | Claude **Opus 4.8** (`claude-opus-4-8`) | reasoning-heavy: rewrite, copilot, matching |
| Cheap LLM | Claude **Haiku 4.5** (`claude-haiku-4-5`) | parsing, classification, extraction |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) | Anthropic has no embeddings API |
| Queue/jobs | Supabase `pg_cron` + `pgmq` (or Vercel Cron + a worker route) | scraping, embedding backfill |
| Browser automation | Playwright (optional, self-hosted worker) | Module 10 form-fill assist only |
| Hosting | Vercel (app) + Supabase (data) | |

> **Model policy:** default to `claude-opus-4-8` for any user-facing reasoning. Use
> `claude-haiku-4-5` only for high-volume, low-stakes extraction. Never use sampling
> params (`temperature`/`top_p`) — they 400 on Opus 4.8. Use
> `thinking: {type: "adaptive"}` and `output_config: {effort: ...}`. See
> `docs/08-ai-prompt-architecture.md`.

---

## Document map

| # | Doc | Covers |
|---|---|---|
| 01 | [System Architecture](docs/01-architecture.md) | components, data flow, diagrams |
| 02 | [Folder Structure](docs/02-folder-structure.md) | full Next.js tree |
| 03 | [Database Schema](docs/03-database-schema.md) | tables, relationships, RLS rationale, storage |
| 04 | [API Design](docs/04-api-design.md) | every endpoint + server action, contracts |
| 05 | [Authentication](docs/05-auth-design.md) | Supabase Auth, session, middleware, roles |
| 06 | [UI Wireframes](docs/06-ui-wireframes.md) | screen-by-screen ASCII wireframes |
| 07 | [Roadmap](docs/07-roadmap.md) | MVP phases + production phases |
| 08 | [AI Prompt Architecture](docs/08-ai-prompt-architecture.md) | per-feature prompts, schemas, model routing |
| 09 | [RAG Architecture](docs/09-rag-architecture.md) | embeddings, chunking, retrieval, matching |
| 10 | [Deployment](docs/10-deployment.md) | envs, CI/CD, cron, workers |
| 11 | [Security](docs/11-security.md) | RLS, PII, secrets, threat model |
| 12 | [Cost Estimation](docs/12-cost-estimation.md) | per-action token math + monthly model |
| 13 | [Scalability](docs/13-scalability.md) | bottlenecks, sharding, caching, scaling plan |

Runnable schema: [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql)

---

## Quick start (once code exists)

```bash
# 1. Scaffold
npx create-next-app@latest ai-career-os --ts --tailwind --app --eslint
cd ai-career-os
npx shadcn@latest init

# 2. Env
cp .env.example .env.local   # fill in keys (see docs/10-deployment.md)

# 3. Database
supabase init
supabase db push             # applies supabase/migrations/*

# 4. Dev
npm run dev
```

Required env vars (full list in `docs/10-deployment.md`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, NEVER exposed to client
ANTHROPIC_API_KEY=                # server only
OPENAI_API_KEY=                   # embeddings only, server only
```

---

## Module → implementation index

| Module | Primary tables | Primary AI feature | Doc |
|---|---|---|---|
| 1 Profile | `profiles`, `education`, `experience`, `skills`, `projects`, `certifications`, `career_goals` | — | 03 |
| 2 Resume Intelligence | `resumes`, `resume_versions`, `resume_analyses` | ATS score + rewrite (Opus) | 08 |
| 3 Job Discovery | `jobs`, `saved_jobs`, `job_sources` | scrape + embed (Haiku/embeddings) | 09 |
| 4 AI Job Matching | `job_matches` | match score (RAG + Opus) | 09 |
| 5 Skill Gap | `skill_gap_reports`, `learning_roadmaps` | aggregate + roadmap (Opus) | 08 |
| 6 Cover Letters | `generated_documents` | letter/email gen (Opus) | 08 |
| 7 Interview Prep | `interview_kits`, `interview_questions` | Q&A gen (Opus) | 08 |
| 8 App Tracker | `applications`, `application_events` | metrics (SQL) | 03 |
| 9 LinkedIn | `generated_documents` (type='linkedin_*') | content gen (Opus) | 08 |
| 10 Semi-auto Apply | `application_runs`, `application_run_steps` | orchestration | 04 |
| 11 Dashboard | views over the above | — | 06 |
| 12 Copilot | `copilot_threads`, `copilot_messages` | chat + RAG (Opus) | 08 |
