# 10 — Deployment Strategy

## 1. Topology

| Component | Host | Notes |
|---|---|---|
| Next.js app | Vercel | RSC, actions, route handlers, edge middleware |
| Postgres + Auth + Storage | Supabase | managed; pgvector, pg_cron |
| Worker (scrapers, Playwright, backfill) | Fly.io / Railway | long-running container, not serverless |
| Embeddings / LLM | OpenAI / Anthropic | API only |

## 2. Environments

| Env | Branch | Supabase project | Notes |
|---|---|---|---|
| Local | — | `supabase start` (Docker) | seeded; service key local-only |
| Preview | PRs | shared staging project | Vercel preview deploys |
| Production | `main` | prod project | protected; migrations gated |

## 3. Env vars (`.env.example`)

```
# public (browser-safe)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=

# server only
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
WORKER_SECRET=

# worker only
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

Set server vars in Vercel project settings (not `NEXT_PUBLIC_`). Worker vars in
Fly/Railway secrets. Rotate `SERVICE_ROLE` and `WORKER_SECRET` on any suspected leak.

## 4. CI/CD

```
GitHub Actions:
  on PR:   typecheck · eslint · build · (optional) supabase db diff check
  on main: Vercel auto-deploy app
           supabase migrations applied via `supabase db push` (manual approval step)
           worker image build + deploy (fly deploy)
```

Migrations are **forward-only** and reviewed; never auto-applied to prod without approval.

## 5. Scheduled jobs

| Job | Schedule | Runner |
|---|---|---|
| Scrape sources | every 2–6h | worker (cron in container) or Vercel Cron → `/internal/jobs/ingest` |
| Embedding backfill (null embeddings) | nightly | worker |
| Skill-gap recompute (active users) | nightly | pg_cron → enqueue → worker |
| Match cache warm (active users) | hourly | worker |
| Stale job prune (posted_at > 60d) | daily | pg_cron |

`pg_cron` + `pgmq` enqueue work; the worker drains the queue. Lightweight pings can use
Vercel Cron hitting an internal route.

## 6. Database migration workflow

```
supabase migration new <name>     # create file
# edit SQL (additive only)
supabase db push                  # local/staging
supabase gen types typescript --local > lib/supabase/database.types.ts
# PR → review → prod push on merge (approval gate)
```

## 7. Streaming on Vercel

Copilot/rewrite use SSE from Route Handlers. Set `export const runtime = "nodejs"` and a
generous `maxDuration` (e.g. 60–300s on Pro). Long backfills do **not** run on Vercel —
they belong to the worker.

## 8. Rollback

- App: Vercel instant rollback to previous deployment.
- DB: forward-fix migration (no destructive down-migrations in prod); Supabase PITR for
  disaster recovery.
- Worker: redeploy previous image tag.

## 9. Pre-launch checklist
- [ ] RLS verified on every table (automated test signs in as 2 users, asserts isolation).
- [ ] Service-role key absent from any client bundle (`grep` build output).
- [ ] Rate limits + AI quotas active.
- [ ] Sentry + cost alerts wired.
- [ ] Storage bucket private; signed URLs only.
- [ ] Backups/PITR enabled.
