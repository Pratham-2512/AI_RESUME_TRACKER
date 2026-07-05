-- =====================================================================
-- 0003 — Job ingestion: polled job sources + feed fields on opportunities
-- Idempotent: safe to re-run.
-- =====================================================================

-- Boards the pipeline polls. `board` is the Greenhouse board token,
-- Lever company slug, or Remotive search query depending on `kind`.
create table if not exists job_sources (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('greenhouse','lever','remotive')),
  board       text not null,
  label       text,
  active      boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_count  int,
  created_at  timestamptz not null default now(),
  unique (kind, board)
);
alter table job_sources enable row level security;

-- Feed fields on opportunities (ingested jobs live alongside pasted ones).
alter table opportunities add column if not exists external_id  text;
alter table opportunities add column if not exists source_id    uuid references job_sources(id) on delete set null;
alter table opportunities add column if not exists apply_url    text;
alter table opportunities add column if not exists salary_text  text;
alter table opportunities add column if not exists posted_at    timestamptz;
alter table opportunities add column if not exists dismissed_at timestamptz;
alter table opportunities add column if not exists starred      boolean not null default false;

-- Dedup: one row per (source, external_id) for ingested jobs.
create unique index if not exists idx_opp_external on opportunities (source, external_id) where external_id is not null;
create index if not exists idx_opp_posted on opportunities (posted_at desc);
create index if not exists idx_opp_feed on opportunities (dismissed_at) where dismissed_at is null;

-- end 0003
