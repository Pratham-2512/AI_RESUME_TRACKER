# 12 — Cost Estimation

Token-based, bottom-up. Prices (per 1M tokens) as configured in `lib/ai/models.ts`:

| Model | Input | Output |
|---|---|---|
| Claude Opus 4.8 (`claude-opus-4-8`) | $5.00 | $25.00 |
| Claude Haiku 4.5 (`claude-haiku-4-5`) | $1.00 | $5.00 |
| OpenAI `text-embedding-3-small` | $0.02 | — |

> Prompt caching makes the cached system-prompt prefix cost ~0.1× on reads — the per-action
> numbers below are **uncached worst case**; steady-state is lower.

## 1. Per-action cost (typical token sizes)

| Action | Model | In (tok) | Out (tok) | Cost / action |
|---|---|---:|---:|---:|
| Resume parse | Haiku | 4,000 | 1,500 | ~$0.0115 |
| Resume analyze | Opus | 6,000 | 2,000 | ~$0.080 |
| Resume rewrite | Opus | 7,000 | 3,500 | ~$0.123 |
| Job embed (per job) | embed | 600 | — | ~$0.000012 |
| Job match (per 5-job batch) | Opus | 4,000 | 2,500 | ~$0.0825 → **$0.0165/job** |
| Skill-gap roadmap | Opus | 3,000 | 2,500 | ~$0.0775 |
| Cover letter | Opus | 3,000 | 800 | ~$0.035 |
| Interview kit | Opus | 4,000 | 4,000 | ~$0.120 |
| Copilot turn | Opus | 8,000 | 1,500 | ~$0.0775 |
| Profile embed | embed | 500 | — | ~$0.00001 |

Cost formula: `in/1e6 * in_price + out/1e6 * out_price`.

## 2. Per active user / month (moderate usage)

| Activity | Volume/mo | Unit | Subtotal |
|---|---:|---|---:|
| Résumé analyze | 4 | $0.080 | $0.32 |
| Résumé rewrite | 4 | $0.123 | $0.49 |
| Matches scored | 80 | $0.0165 | $1.32 |
| Cover letters | 10 | $0.035 | $0.35 |
| Interview kits | 3 | $0.120 | $0.36 |
| Skill-gap | 4 | $0.0775 | $0.31 |
| Copilot turns | 60 | $0.0775 | $4.65 |
| Embeddings (profile+résumé) | — | — | ~$0.01 |
| **AI total / active user** | | | **≈ $7.8** |

Caching (system-prompt reuse + match caching keyed on `profile_version`) realistically
trims this to **~$4–6/active user/month**. Copilot dominates — gate it behind plan limits.

## 3. Job-pipeline cost (shared, not per-user)

| Item | Volume | Unit | Cost/mo |
|---|---:|---|---:|
| New jobs embedded | 50,000 | $0.000012 | ~$0.60 |
| Skill tagging (Haiku, optional) | 50,000 | ~$0.0008 | ~$40 |

Embeddings are negligible; LLM skill-tagging on every job is the swing factor — only run it
when source data lacks a skills field.

## 4. Infrastructure (monthly, by stage)

| Stage | Users | Vercel | Supabase | Worker | LLM/embed | **Total** |
|---|---:|---:|---:|---:|---:|---:|
| MVP / beta | ~100 active | $20 (Pro) | $25 (Pro) | $5–10 | ~$500 | **~$555** |
| Growth | ~1,000 active | $20–100 | $25–100 | $25 | ~$5,000 | **~$5.2k** |
| Scale | ~10,000 active | $200+ | $200–500 | $100+ | ~$45k* | **~$46k** |

\* With caching, quotas, and Haiku-tiering for parse/tag, LLM at 10k users is closer to
**$25–35k**. LLM is ~90% of marginal cost — every optimization should target it.

## 5. Cost-control levers (in priority order)
1. **Prompt caching** on every frozen system prompt (~0.1× cached reads).
2. **Match caching** keyed on `profile_version` — never re-score unchanged profiles.
3. **Tier models:** Haiku for parse/classification; Opus only for judgment/writing.
4. **Effort tuning:** `medium` for batched match scoring; `high` for user-facing quality.
5. **Per-user quotas** (esp. copilot) + plan tiers (free caps, pro pays).
6. **Batch** embeddings + match scoring; dedup jobs hard (unique `(source, external_id)`).
7. **`ai_usage_log`** dashboards + alerts to catch regressions/abuse early.

## 6. Unit economics → pricing
At ~$5/active-user AI cost, a **$15–25/mo Pro plan** gives healthy margin; a **free tier**
with hard caps (e.g. 3 résumé rewrites, 20 copilot turns, 50 matches/mo) keeps free-user
cost ≈ $1–2.
