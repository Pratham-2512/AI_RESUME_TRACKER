# 09 — RAG Architecture

RAG powers three things: **job matching** (Module 4), **copilot grounding** (Module 12),
and **resume↔job keyword analysis** (Module 2). All vectors are 1536-dim
(`text-embedding-3-small`), stored in `pgvector`, queried with cosine via HNSW.

## 1. What gets embedded

| Source | Column | Text composed from | When |
|---|---|---|---|
| Job | `jobs.embedding` | `title \n company \n location \n description \n skills` | on ingest / update (worker) |
| Resume chunk | `resume_chunks.embedding` | ~500-token chunk of resume text | after parse |
| Profile | `profiles.embedding` | synthesized profile summary (below) | on profile edit (debounced) |

**Profile summary** (the matching query vector) is generated once per `profile_version`:
a compact paragraph of target roles, top skills (weighted by proficiency/years), seniority,
and domain — built deterministically in `lib/domain/profileSummary.ts`, then embedded.

## 2. Chunking

- Resumes: split on section + sentence boundaries to ~500 tokens, ~50 token overlap.
- Jobs: embedded whole (descriptions are short enough); if > ~1k tokens, embed the
  title+skills+first 800 tokens (the signal-dense head).

## 3. Embedding service (`lib/ai/embeddings.ts`)

```ts
import OpenAI from "openai";
const openai = new OpenAI();                 // OPENAI_API_KEY, server only

export async function embed(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return r.data[0].embedding;                // length 1536
}
export async function embedBatch(texts: string[]): Promise<number[][]> { /* up to 2048/call */ }
```

Batch on ingest (worker embeds many jobs per call). Cache by content hash to avoid
re-embedding unchanged text.

## 4. Retrieval

### 4.1 Job matching (two-stage: retrieve → rerank with LLM)

```
Stage 1 (cheap, ANN):   match_jobs(profile.embedding, K=50, type?, mode?)   -- pgvector
Stage 2 (LLM rerank):   Opus scores the 50 candidates 0-100 (batched, 5/call)
                        → cache in job_matches; UI sorts by match_score
```

Stage 1 narrows the global `jobs` table to the 50 most semantically similar; Stage 2
applies calibrated reasoning. This keeps Opus cost bounded (50 jobs, not the whole table)
while giving high-quality ranking. `match_jobs()` is the SQL RPC in the migration.

### 4.2 Copilot grounding

```
On each user turn:
  ctx = [
    profileSummary(user),                       -- deterministic
    topMatches(user, 5),                         -- from job_matches
    recentApplications(user, 5),                 -- funnel state
    vectorSearch(resume_chunks, queryEmbed, 4),  -- relevant resume bits
    vectorSearch(jobs, queryEmbed, 4),           -- relevant jobs to the question
  ]
inject ctx as a messages turn (NOT the cached system prompt)
```

`queryEmbed = embed(userMessage)`. Resume-chunk search is RLS-scoped to the user; job
search uses `match_jobs`.

### 4.3 Resume keyword analysis

For "missing keywords vs a job", embed both resume chunks and the job, but the actual
keyword extraction is done by Opus in the analyze prompt (5.2) — the vectors only select
the most relevant resume chunks to feed in when a resume is long.

## 5. Why this split (vector vs LLM)

- **Vectors** = recall + cost control (find plausibly relevant items fast, globally).
- **LLM** = precision + explanation (calibrated scores, strengths/gaps, rationale).
  Pure cosine similarity ranks "similar text", not "good fit" — a junior and senior JD can
  be near-identical in embedding space. The LLM rerank fixes that.

## 6. Freshness & invalidation

| Vector | Recomputed when |
|---|---|
| `jobs.embedding` | job text changes (worker upsert) |
| `resume_chunks` | resume re-parsed (old chunks deleted, re-embedded) |
| `profiles.embedding` | `profile_version` bump → `reembedProfile()` |
| `job_matches` | profile_version bump (new rows computed lazily on next view) |

## 7. Index tuning

- HNSW (`m=16`, `ef_construction=64` defaults are fine at MVP scale).
- Set `hnsw.ef_search` per query (e.g. 100) for recall on the K=50 retrieval.
- Revisit (IVFFlat or partitioning) only past ~1M jobs — see `docs/13`.

## 8. Failure modes & guards

- Embedding API error → job ingested with `embedding = null`; excluded from
  `match_jobs` (the `where embedding is not null` clause); backfilled by a nightly cron.
- Empty profile (new user) → matching falls back to keyword filter over `skills_required`
  until enough profile data exists to embed.
