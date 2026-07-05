-- 0004 — bump_profile_version ran an unqualified UPDATE, which the
-- database rejects (error 21000: UPDATE requires a WHERE clause), so every
-- insert into skills/experience/education/projects failed. Scope it to the
-- singleton profile row.
create or replace function bump_profile_version()
returns trigger as $$
begin
  update profiles
  set profile_version = profile_version + 1
  where singleton = true;
  return coalesce(new, old);
end;
$$ language plpgsql;
