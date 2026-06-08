# 04 — API Design

Three call styles, chosen by use case:

| Style | Use for | Auth |
|---|---|---|
| **Server Action** | mutations from forms/buttons (CRUD, save, status change) | user JWT, RLS |
| **Route Handler `/api/*`** | streaming AI, file ops, webhooks, worker callbacks | user JWT or worker secret |
| **Direct Supabase (RSC)** | reads inside server components | user JWT, RLS |

Conventions: all inputs validated with **Zod**; all responses
`{ data, error }`-shaped; AI routes stream where the payload is large.

---

## 1. Profile (Module 1) — Server Actions

```
updateProfile(input: ProfileInput): Profile
addEducation / updateEducation / deleteEducation(...)
addExperience / updateExperience / deleteExperience(...)
addSkill / updateSkill / deleteSkill(...)
addProject / addCertification / setCareerGoal(...)
reembedProfile(): void          # rebuilds profiles.embedding after edits
```

Each mutation runs through `lib/domain` validation then the RLS-scoped client.
`reembedProfile` is debounced server-side (only re-embeds if `profile_version` changed
since last embed).

---

## 2. Resume Intelligence (Module 2)

```
POST /api/resume/upload            multipart → Storage + resumes row (status=parsing)
POST /api/ai/resume/parse          {resumeId} → Haiku extracts parsed_json; chunk+embed
POST /api/ai/resume/analyze        {resumeId, jobId?} (stream) → resume_analyses
POST /api/ai/resume/rewrite        {resumeId, target} (stream) → resume_versions (+after_score)
GET  /api/resume/:id/export        → PDF download (signed)
```

`analyze` returns the **before** score + breakdown; `rewrite` produces the optimized
variant and its **after** score. UI diffs the two. `rewrite` accepts `target ∈
{ats, ai_engineer, data_analyst, software_developer, ml_engineer}`.

Response schema (analyze) — also the AI structured-output schema:

```ts
{ before_score: number, ats_breakdown: {formatting,keywords,impact,readability:number},
  matched_keywords: string[], missing_keywords: string[], missing_skills: string[],
  weak_sections: {section,issue,suggestion}[], suggestions:{priority,area,suggestion}[] }
```

---

## 3. Job Discovery (Module 3)

```
GET  /api/jobs            ?q&type&mode&salaryMin&skills&sort&page  (keyword + filters)
GET  /api/jobs/:id
POST /api/jobs/:id/save    → saved_jobs
DELETE /api/jobs/:id/save
# ingestion (worker only, service role):
POST /api/internal/jobs/ingest    x-worker-secret → upsert jobs + embed
```

List endpoint supports server-side pagination (keyset on `posted_at`), full-text on
`title` (pg_trgm), and array-overlap on `skills_required`.

---

## 4. AI Job Matching (Module 4)

```
GET  /api/ai/matches              ?refresh=bool → ranked job_matches
POST /api/ai/matches/recompute    {jobIds?}     → (re)score against current profile_version
```

Pipeline: `match_jobs(profile.embedding, K=50)` → for each candidate not already cached
at current `profile_version`, batch-score with Opus → upsert `job_matches`. Warm reads
return cached rows instantly.

---

## 5. Skill Gap (Module 5)

```
POST /api/ai/skill-gap            {scope=matched|saved|market} → skill_gap_reports
POST /api/ai/skill-gap/roadmap    {reportId} → learning_roadmaps (4-week, ROI-ranked)
```

Aggregation (most-requested / missing-frequency) is computed in SQL over the user's
matched jobs; Opus only synthesizes the roadmap + ROI ranking.

---

## 6. Documents — Cover letters & LinkedIn (Modules 6, 9)

```
POST /api/ai/document             {type, jobId?, resumeId?, tone} (stream) → generated_documents
GET  /api/documents               ?type
PUT  /api/documents/:id           edit + save
```

`type` covers both modules (`cover_letter`, `recruiter_message`, `hiring_manager_email`,
`followup_email`, `linkedin_headline`, `linkedin_about`, `linkedin_post`,
`linkedin_project_post`, `linkedin_connect`).

---

## 7. Interview Prep (Module 7)

```
POST /api/ai/interview/kit        {jobId?} (stream) → interview_kits + interview_questions
GET  /api/interview/kits/:id
```

Generates technical/HR/behavioral/project questions with suggested answers, difficulty,
and a confidence rating, grounded in the user's profile + the job description.

---

## 8. Application Tracker (Module 8)

```
POST   /api/applications          {jobId, status, ...}
PATCH  /api/applications/:id       {status, notes, followupDate}   # trigger logs event
GET    /api/applications           ?status
GET    /api/applications/metrics   → {total, byStatus, interviewRate, offerRate, rejectionRate}
```

Metrics computed in SQL from `applications` + `application_events`.

---

## 9. Semi-Automated Apply (Module 10) — orchestrated, approval-gated

```
POST  /api/runs                    {jobId} → application_runs (draft) + steps
POST  /api/runs/:id/advance        runs next step: analyze → optimize → letter → recruiter msg
GET   /api/runs/:id                 current state + previews
POST  /api/runs/:id/approve        sets approved_at  ← REQUIRED human gate
POST  /api/runs/:id/assist         returns field-map for Playwright worker (post-approval only)
POST  /api/runs/:id/submitted      user confirms they submitted → status=submitted + creates application
```

**Invariant (enforced server-side):** `assist` and `submitted` return 409 unless
`approved_at IS NOT NULL`. The system **never auto-submits**. Playwright only *fills* the
form; the user clicks submit. See `docs/11-security.md` §automation.

---

## 10. Copilot (Module 12)

```
POST /api/ai/copilot              {threadId?, message} (SSE stream)
GET  /api/copilot/threads
GET  /api/copilot/threads/:id
```

Streaming Route Handler. Builds RAG context (profile summary + matches + resume chunks +
recent applications), runs Opus 4.8 with tools (`get_matches`, `get_skill_gap`,
`draft_document`, `explain_rejections`). Persists `copilot_messages` with token counts on
completion.

---

## 11. Standard error contract

```ts
type ApiResult<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } };
// codes: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION, RATE_LIMITED,
//        AI_ERROR, RUN_NOT_APPROVED, QUOTA_EXCEEDED
```

Rate limiting: per-user token bucket on AI routes (Upstash or pg-based), surfaced as
`RATE_LIMITED` with `retry-after`.
