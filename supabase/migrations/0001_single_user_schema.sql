-- =====================================================================
-- AI Career OS — MASTER MIGRATION (single-user, canonical schema)
-- Paste this whole file into Supabase SQL Editor and Run.
-- Idempotent: safe to re-run. RLS enabled, no client policies (server/service_role only).
--
-- Canonical product entities: profile · resumes · resume_versions ·
-- opportunities · applications · coaching_sessions · analytics_events.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ---- ENUMS ----
do $$ begin
  create type job_type      as enum ('full_time','internship','contract','part_time');
  create type work_mode     as enum ('remote','hybrid','onsite');
  create type app_status    as enum ('saved','applied','assessment','interview','final_round','offer','rejected','ghosted');
  create type resume_target as enum ('ats','ai_engineer','data_analyst','software_developer','ml_engineer','data_scientist','python_developer','full_stack','generic');
  create type doc_type      as enum (
    'cover_letter','recruiter_message','hiring_manager_email','followup_email','thank_you_email',
    'linkedin_headline','linkedin_about','linkedin_post','linkedin_project_post','linkedin_connect');
  create type question_kind as enum ('technical','hr','behavioral','project');
  create type difficulty     as enum ('easy','medium','hard');
exception when duplicate_object then null; end $$;

-- ---- OWNER PROFILE (singleton) ----
create table if not exists profiles (
  id               uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  full_name        text, email text, phone text, location text,
  headline text, summary text, career_goals text,
  target_roles     text[] default '{}', years_experience numeric(4,1),
  profile_version  int not null default 1, embedding vector(1536),
  singleton        boolean not null default true unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---- CAREER DATA ----
create table if not exists education (
  id uuid primary key default gen_random_uuid(), school text not null, degree text, field text,
  grade text, start_date date, end_date date, is_current boolean default false,
  description text, sort_order int default 0, created_at timestamptz not null default now());
create table if not exists experience (
  id uuid primary key default gen_random_uuid(), company text not null, title text not null,
  location text, employment_type job_type, start_date date, end_date date, is_current boolean default false,
  description text, highlights text[] default '{}', sort_order int default 0, created_at timestamptz not null default now());
create table if not exists skills (
  id uuid primary key default gen_random_uuid(), name text not null unique, category text,
  proficiency int check (proficiency between 1 and 5), years numeric(3,1), created_at timestamptz not null default now());
create table if not exists certifications (
  id uuid primary key default gen_random_uuid(), name text not null, issuer text,
  issued_date date, expiry_date date, credential_url text, created_at timestamptz not null default now());
create table if not exists projects (
  id uuid primary key default gen_random_uuid(), name text not null, description text,
  tech_stack text[] default '{}', url text, repo_url text, highlights text[] default '{}',
  sort_order int default 0, created_at timestamptz not null default now());
create table if not exists career_goals (
  id uuid primary key default gen_random_uuid(), goal text not null, target_role text,
  target_salary int, horizon_months int, status text default 'active', created_at timestamptz not null default now());

-- ---- RESUME STUDIO ----
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(), label text, storage_path text, source text default 'upload',
  target resume_target default 'generic', parsed_text text, parsed_json jsonb,
  status text default 'uploaded', is_primary boolean default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  version_no int not null, target resume_target not null default 'generic',
  content_md text, content_json jsonb, ats_score int check (ats_score between 0 and 100),
  created_by_ai boolean default false, created_at timestamptz not null default now(),
  unique (resume_id, version_no));

-- ---- OPPORTUNITIES (Jobs + Matches merged) ----
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  source text default 'paste', url text, title text not null, company text, location text,
  work_mode work_mode, job_type job_type, job_text text,
  required_skills text[] default '{}', years_required int,
  match_score int check (match_score between 0 and 100),
  interview_prob_label text, interview_prob_pct int,
  matched_skills text[] default '{}', missing_skills text[] default '{}',
  strengths text[] default '{}', weaknesses text[] default '{}',
  strategy text, recommended_resume resume_target, model text,
  status app_status not null default 'saved', embedding vector(1536),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists resume_analyses (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  before_score int, after_score int, ats_breakdown jsonb,
  matched_keywords text[] default '{}', missing_keywords text[] default '{}', missing_skills text[] default '{}',
  weak_sections jsonb, suggestions jsonb, model text, created_at timestamptz not null default now());

-- ---- APPLICATION PIPELINE ----
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete set null,
  job_title text, company text, status app_status not null default 'saved',
  applied_at date, followup_date date,
  resume_version_id uuid references resume_versions(id) on delete set null,
  notes text, source text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  from_status app_status, to_status app_status not null, note text,
  created_at timestamptz not null default now());

-- ---- DOCUMENTS / INTERVIEW / LEARNING ----
create table if not exists generated_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete set null,
  resume_id uuid references resumes(id) on delete set null,
  type doc_type not null, title text, content text not null, tone text, model text,
  created_at timestamptz not null default now());
create table if not exists interview_kits (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete set null, title text, model text,
  created_at timestamptz not null default now());
create table if not exists interview_questions (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references interview_kits(id) on delete cascade,
  kind question_kind not null, difficulty difficulty default 'medium',
  question text not null, suggested_answer text, confidence int, sort_order int default 0,
  created_at timestamptz not null default now());
create table if not exists skill_gap_reports (
  id uuid primary key default gen_random_uuid(), scope text default 'matched',
  most_requested jsonb, missing_frequency jsonb, market_trends jsonb, model text,
  created_at timestamptz not null default now());
create table if not exists learning_roadmaps (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references skill_gap_reports(id) on delete set null,
  title text, weeks jsonb, created_at timestamptz not null default now());

-- ---- COACH ----
create table if not exists coaching_sessions (
  id uuid primary key default gen_random_uuid(), title text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists coaching_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references coaching_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null, tokens_in int, tokens_out int, created_at timestamptz not null default now());

-- ---- ANALYTICS (AI usage + product events) ----
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'ai_usage', feature text, model text,
  tokens_in int default 0, tokens_out int default 0, cost_usd numeric(10,6) default 0,
  latency_ms int, props jsonb, created_at timestamptz not null default now());

-- ---- INDEXES ----
create index if not exists idx_rv_resume on resume_versions(resume_id);
create index if not exists idx_ra_resume on resume_analyses(resume_id);
create index if not exists idx_opp_status on opportunities(status);
create index if not exists idx_opp_score on opportunities(match_score desc);
create index if not exists idx_opp_skills on opportunities using gin (required_skills);
create index if not exists idx_apps_status on applications(status);
create index if not exists idx_appev_app on application_events(application_id);
create index if not exists idx_iq_kit on interview_questions(kit_id);
create index if not exists idx_cm_session on coaching_messages(session_id);
create index if not exists idx_ae_created on analytics_events(created_at);
create index if not exists idx_opp_embedding on opportunities using hnsw (embedding vector_cosine_ops);

-- ---- TRIGGERS ----
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
do $$ begin
  create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
  create trigger trg_resumes_updated  before update on resumes  for each row execute function set_updated_at();
  create trigger trg_opp_updated      before update on opportunities for each row execute function set_updated_at();
  create trigger trg_apps_updated     before update on applications for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

create or replace function bump_profile_version() returns trigger as $$
begin update profiles set profile_version = profile_version + 1; return coalesce(new, old); end;
$$ language plpgsql;
do $$ begin
  create trigger trg_bump_skills after insert or update or delete on skills for each row execute function bump_profile_version();
  create trigger trg_bump_exp    after insert or update or delete on experience for each row execute function bump_profile_version();
  create trigger trg_bump_edu    after insert or update or delete on education for each row execute function bump_profile_version();
  create trigger trg_bump_proj   after insert or update or delete on projects for each row execute function bump_profile_version();
exception when duplicate_object then null; end $$;

create or replace function log_application_event() returns trigger as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into application_events (application_id, from_status, to_status) values (new.id, old.status, new.status);
  end if; return new;
end; $$ language plpgsql;
do $$ begin
  create trigger trg_log_app_event after update on applications for each row execute function log_application_event();
exception when duplicate_object then null; end $$;

-- ---- RPC: vector match over opportunities ----
create or replace function match_opportunities(query_embedding vector(1536), match_count int default 50)
returns table (opportunity_id uuid, similarity float) as $$
  select o.id, 1 - (o.embedding <=> query_embedding)
  from opportunities o where o.embedding is not null
  order by o.embedding <=> query_embedding limit match_count;
$$ language sql stable;

-- ---- RLS: on everywhere, no client policies (service_role only) ----
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','education','experience','skills','certifications','projects','career_goals',
    'resumes','resume_versions','resume_analyses','opportunities','applications','application_events',
    'generated_documents','interview_kits','interview_questions','skill_gap_reports','learning_roadmaps',
    'coaching_sessions','coaching_messages','analytics_events'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ---- STORAGE ----
insert into storage.buckets (id, name, public) values ('resumes','resumes', false)
on conflict (id) do nothing;

-- ---- SEED: singleton owner profile ----
insert into profiles (id) values ('00000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

-- end master migration
