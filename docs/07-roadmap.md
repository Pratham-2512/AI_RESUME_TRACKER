# 07 — Roadmap

Estimates assume 1–2 engineers. Each phase ends shippable.

## MVP (≈ 6–8 weeks) — "useful single-player career tool"

### Phase 0 — Foundation (week 1)
- Scaffold Next.js 15 + TS + Tailwind + shadcn. CI (lint/typecheck/build).
- Supabase project; apply `0001_initial_schema.sql`; generate DB types.
- Auth: email/password + Google + magic link; middleware gate; `(auth)` + `(app)` shells.
- `lib/supabase/{server,browser,admin}`, `lib/ai/client`, `.env` plumbing.
- **Exit:** sign up → land on empty dashboard; RLS verified (no cross-tenant reads).

### Phase 1 — Profile + Resume Intelligence (weeks 2–3) · Modules 1, 2
- Profile CRUD (all sub-entities) + `profile_version` trigger + profile embedding.
- Resume upload → Storage → Haiku parse → chunk + embed.
- ATS analyze (Opus, structured output) → before score + breakdown.
- Resume rewrite (Opus, streamed) → versions + after score; before/after UI.
- **Exit:** upload résumé, see ATS score, get an optimized version.

### Phase 2 — Jobs + Matching (weeks 4–5) · Modules 3, 4
- Worker: 1–2 scrapers (Greenhouse/Lever) → `jobs` upsert + embed via `/internal/ingest`.
- Discovery UI: search/filter/sort/saved.
- `match_jobs` retrieval + Opus rerank → `job_matches`; matches list + breakdown rail.
- **Exit:** browse real jobs, see ranked matches with strengths/gaps.

### Phase 3 — Documents + Applications (weeks 6–7) · Modules 6, 8
- Cover letter / recruiter / email generation (Opus, streamed, editable, saved).
- Application tracker kanban + status events + metrics endpoint + dashboard cards.
- **Exit:** generate a cover letter, track an application through the funnel.

### Phase 4 — Copilot + polish (week 8) · Module 12
- Streaming copilot with RAG context + 2 tools (`get_matches`, `explain_rejections`).
- Dashboard trends; empty states; rate limiting; `ai_usage_log` wired everywhere.
- **Exit:** end-to-end demo: profile → résumé → match → letter → track → ask copilot.

**MVP cut list (defer):** Modules 5 (skill gap), 7 (interview), 9 (LinkedIn), 10
(semi-auto apply) — all are additive on the same schema.

---

## Production (post-MVP, ≈ 8–12 weeks)

### Phase 5 — Remaining AI modules · Modules 5, 7, 9
- Skill-gap aggregation + ROI roadmap; interview kit generator; LinkedIn assistant.
- Copilot gains `get_skill_gap` + `draft_document` tools.

### Phase 6 — Semi-automated apply · Module 10
- Run orchestration state machine (`application_runs` + steps).
- Approval gate enforced server-side; Playwright form-fill **assist** worker.
- Never auto-submits; user confirms submission.

### Phase 7 — Scale & reliability
- Job pipeline hardening: more sources, dedup, nightly embedding backfill, freshness.
- Caching (prompt caching audit, match cache warming), pg_cron schedules.
- Observability: Sentry, structured logs, AI cost dashboards, alerting.
- Per-user AI quotas + plan tiers (free/pro) + Stripe.

### Phase 8 — Growth
- Admin console (manage `job_sources`, inspect usage), team/coach accounts,
  email digests (new matches), browser extension for 1-click job capture,
  evals harness for prompt regressions.

---

## Definition of done (every AI feature)
- Structured output validated (Zod) or stream completes cleanly.
- `ai_usage_log` row written with cost.
- Result cached/persisted to its table; invalidation keyed correctly.
- Refusal + max_tokens handled; user sees graceful error, not a crash.
- Loading/streaming/empty states implemented.
