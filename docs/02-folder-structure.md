# 02 — Folder Structure

```
ai-career-os/
├─ app/
│  ├─ (marketing)/                 # public
│  │  ├─ page.tsx                  # landing
│  │  └─ pricing/page.tsx
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  ├─ signup/page.tsx
│  │  └─ auth/callback/route.ts    # OAuth/magic-link code exchange
│  ├─ (app)/                       # protected (middleware-gated)
│  │  ├─ layout.tsx                # sidebar shell, loads session + profile
│  │  ├─ dashboard/page.tsx        # Module 11
│  │  ├─ profile/page.tsx          # Module 1
│  │  ├─ resumes/
│  │  │  ├─ page.tsx               # list + upload
│  │  │  └─ [id]/page.tsx          # analysis, rewrite, before/after  (Module 2)
│  │  ├─ jobs/
│  │  │  ├─ page.tsx               # discovery: search/filter/sort   (Module 3)
│  │  │  └─ [id]/page.tsx          # detail + match breakdown          (Module 4)
│  │  ├─ matches/page.tsx          # ranked matches                    (Module 4)
│  │  ├─ skills/page.tsx           # gap analysis + roadmap            (Module 5)
│  │  ├─ documents/page.tsx        # cover letters / emails            (Module 6)
│  │  ├─ linkedin/page.tsx         # LinkedIn assistant                (Module 9)
│  │  ├─ interview/[kitId]/page.tsx# interview prep                    (Module 7)
│  │  ├─ applications/page.tsx     # tracker board + metrics           (Module 8)
│  │  ├─ apply/[runId]/page.tsx    # semi-auto apply wizard            (Module 10)
│  │  └─ copilot/page.tsx          # chat                              (Module 12)
│  ├─ api/
│  │  ├─ resume/
│  │  │  ├─ upload/route.ts
│  │  │  └─ [id]/export/route.ts
│  │  ├─ jobs/route.ts             # list + filters
│  │  ├─ applications/
│  │  │  ├─ route.ts
│  │  │  └─ metrics/route.ts
│  │  ├─ runs/[id]/...             # advance|approve|assist|submitted
│  │  ├─ ai/
│  │  │  ├─ resume/{parse,analyze,rewrite}/route.ts
│  │  │  ├─ matches/route.ts
│  │  │  ├─ skill-gap/route.ts
│  │  │  ├─ document/route.ts
│  │  │  ├─ interview/kit/route.ts
│  │  │  └─ copilot/route.ts       # SSE streaming
│  │  └─ internal/                 # worker-only (x-worker-secret)
│  │     └─ jobs/ingest/route.ts
│  └─ middleware.ts                # session refresh + auth gate
│
├─ actions/                        # Server Actions (mutations)
│  ├─ profile.ts
│  ├─ resumes.ts
│  ├─ jobs.ts
│  ├─ documents.ts
│  └─ applications.ts
│
├─ components/
│  ├─ ui/                          # shadcn primitives
│  ├─ profile/  resumes/  jobs/  matches/  skills/
│  ├─ documents/  interview/  applications/  apply/  copilot/
│  └─ shared/                      # ScoreRing, EmptyState, StreamingText...
│
├─ lib/
│  ├─ supabase/{server,browser,admin}.ts  database.types.ts
│  ├─ ai/
│  │  ├─ client.ts  models.ts  embeddings.ts
│  │  ├─ prompts/{resume,match,skillgap,document,interview,copilot}.ts
│  │  ├─ pipelines/{resumeAnalyze,resumeRewrite,jobMatch,skillGap,interviewKit,copilot}.ts
│  │  └─ usage.ts                  # ai_usage_log writer + cost calc
│  ├─ rag/{retrieve,profileSummary}.ts
│  ├─ domain/{scoring,metrics,validation}.ts
│  └─ utils/
│
├─ supabase/
│  ├─ migrations/0001_initial_schema.sql
│  └─ seed.sql                     # job_sources seed
│
├─ worker/                         # separate deploy (Fly/Railway)
│  ├─ scrapers/{greenhouse,lever}.ts
│  ├─ embedBackfill.ts
│  └─ playwright/formFill.ts       # Module 10 assist (post-approval only)
│
├─ docs/                           # this spec
├─ .env.example
└─ package.json
```

**Conventions**

- Route groups `(marketing)`, `(auth)`, `(app)` separate layouts/auth posture.
- Mutations live in `actions/`; AI + streaming + files live in `app/api/`.
- `lib/ai` is the only place importing the Anthropic/OpenAI SDKs.
- `lib/supabase/admin.ts` is import-restricted to `worker/**` and `app/api/internal/**`.
- `worker/` is its own package/deploy — not bundled into the Vercel app.
