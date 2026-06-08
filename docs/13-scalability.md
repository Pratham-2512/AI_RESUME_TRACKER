# 13 — Future Scalability Plan

## 1. Where it breaks first (bottlenecks, in order)

1. **LLM cost & rate limits** — dominant marginal cost; Anthropic org RPM/TPM limits.
2. **Vector search on `jobs`** as the table grows to millions.
3. **Match recomputation** fan-out when many users + many new jobs.
4. **Worker throughput** (scraping + embedding) at high job volume.
5. **Postgres connections** from serverless functions.

## 2. Scaling each layer

### LLM
- Prompt caching + match caching (already in design) → biggest lever.
- Per-user quotas + plan tiers cap spend and protect rate limits.
- Request higher org tier; spread load; queue + backoff (SDK auto-retries 429/5xx).
- Batch where latency-tolerant; consider the **Batches API** (50% cheaper) for nightly
  match/skill-gap recompute of inactive users.
- Tier aggressively: Haiku for parse/tag, Opus only for judgment.

### Vector search
- HNSW scales to ~1–2M rows comfortably on a sized instance.
- Beyond that: partition `jobs` by recency (hot last-60-days partition carries the ANN
  index; archive older), or move vectors to a dedicated store (e.g. a managed vector DB)
  if Postgres ANN latency degrades.
- Pre-filter before ANN (type/mode/recency) to shrink the search set.
- Tune `hnsw.ef_search` per query for the recall/latency tradeoff.

### Match computation
- Lazy by default (compute on view, cache on `profile_version`).
- For active users, **warm** caches hourly via worker so reads are instant.
- New-job arrival does **not** trigger global rescoring; matches are computed against the
  user's current profile when they next view, against the top-K retrieved candidates only.

### Worker
- Horizontally scalable stateless workers draining a `pgmq` queue.
- Idempotent upserts (unique `(source, external_id)`); backfill is restartable.
- Separate queues/priorities: scrape > embed > skill-tag.

### Postgres / connections
- Use Supabase **connection pooler** (PgBouncer, transaction mode) for serverless.
- Read-heavy dashboard queries → materialized views / cached RSC.
- Add covering indexes as query patterns emerge (already indexed the hot paths).

## 3. Caching tiers

| Tier | What | TTL / key |
|---|---|---|
| API (Anthropic) | system-prompt prefix | per model/system |
| DB | `job_matches`, `skill_gap_reports`, embeddings | `profile_version` / content hash |
| App | dashboard aggregates, job lists | short RSC cache / revalidate |
| CDN | static + marketing | Vercel edge |

## 4. Multi-region / latency
- App is global on Vercel edge; DB single-region initially.
- If EU latency/residency matters: regional Supabase project + read replicas; pin EU users.

## 5. Reliability
- Graceful degradation: embedding failure → null embedding + nightly backfill; LLM
  failure → cached/last-known result + retry; copilot tool failure → answer without tool.
- Circuit breakers + timeouts on all external calls.
- Idempotency keys on ingestion and run-advance steps.

## 6. Data growth & retention
- Prune jobs older than N days (cron) to keep the ANN index hot.
- Archive `ai_usage_log` to cold storage monthly; keep rollups.
- Partition large append-only tables (`ai_usage_log`, `application_events`) by month.

## 7. Capacity milestones

| Users (active) | Key actions |
|---|---|
| 1k | pooler on; match warming; quotas live; caching audited |
| 10k | Batches API for inactive recompute; jobs partitioning; cost dashboards + alerts |
| 100k | dedicated vector store or sharded ANN; read replicas; regional deploys; org rate-limit tier bumps; possible fine-tuned/cheaper model for parse/tag |

## 8. Team & process scaling
- Evals harness for prompt regressions before model/prompt changes ship.
- Feature flags for risky AI changes; canary on a % of users.
- Forward-only migrations; typed DB client regenerated in CI.
