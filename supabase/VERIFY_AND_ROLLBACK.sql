-- =====================================================================
-- VERIFICATION QUERIES — run AFTER applying 0001_single_user_schema.sql
-- =====================================================================

-- 1. All expected tables present? (should list 21 rows)
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2. The 6 "expected minimum entities" specifically (should return 6 rows)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('resumes','resume_versions','applications','opportunities','coaching_sessions','analytics_events')
order by table_name;

-- 3. RLS enabled on every table? (rowsecurity should be true for all)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 4. Singleton owner profile seeded? (should return exactly 1 row)
select id, profile_version from profiles;

-- 5. Storage bucket created & private? (public should be false)
select id, public from storage.buckets where id = 'resumes';

-- 6. Vector + extensions installed?
select extname from pg_extension where extname in ('vector','pg_trgm','pgcrypto');

-- 7. End-to-end CRUD smoke test (insert → select → delete an opportunity)
insert into opportunities (title, match_score, status) values ('VERIFY TEST', 50, 'saved') returning id;
select count(*) as opp_count from opportunities where title = 'VERIFY TEST';
delete from opportunities where title = 'VERIFY TEST';

-- =====================================================================
-- ROLLBACK PLAN — drops everything this migration created.
-- WARNING: destroys all data in these tables. Run only to fully reset.
-- Order: child tables / dependents first, then parents, then types.
-- =====================================================================
/*
drop table if exists analytics_events       cascade;
drop table if exists coaching_messages       cascade;
drop table if exists coaching_sessions        cascade;
drop table if exists learning_roadmaps        cascade;
drop table if exists skill_gap_reports        cascade;
drop table if exists interview_questions      cascade;
drop table if exists interview_kits           cascade;
drop table if exists generated_documents      cascade;
drop table if exists application_events       cascade;
drop table if exists applications             cascade;
drop table if exists resume_analyses          cascade;
drop table if exists opportunities            cascade;
drop table if exists resume_versions          cascade;
drop table if exists resumes                  cascade;
drop table if exists career_goals             cascade;
drop table if exists projects                 cascade;
drop table if exists certifications           cascade;
drop table if exists skills                   cascade;
drop table if exists experience               cascade;
drop table if exists education                cascade;
drop table if exists profiles                 cascade;

drop function if exists match_opportunities(vector, int) cascade;
drop function if exists bump_profile_version() cascade;
drop function if exists log_application_event() cascade;
drop function if exists set_updated_at() cascade;

drop type if exists difficulty     cascade;
drop type if exists question_kind  cascade;
drop type if exists doc_type       cascade;
drop type if exists resume_target  cascade;
drop type if exists app_status     cascade;
drop type if exists work_mode      cascade;
drop type if exists job_type       cascade;

-- (Storage bucket is left intact; remove manually if desired:)
-- delete from storage.buckets where id = 'resumes';
*/
