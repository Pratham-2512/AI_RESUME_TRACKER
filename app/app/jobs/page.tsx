import { Briefcase } from "lucide-react";
import { createDb } from "@/lib/supabase/db";
import { PageHeader, StatCard, InfoBanner } from "@/components/shared/ui";
import { JobFeed, type FeedJob, type CandidateContext } from "@/components/jobs/job-feed";
import { SourceManager, type SourceItem } from "@/components/jobs/source-manager";
import { OWNER_ID } from "@/lib/owner";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let sources: SourceItem[] = [];
  let jobs: FeedJob[] = [];
  let candidate: CandidateContext = { years: null, targetRoles: [] };
  let dbError: string | null = null;

  try {
    const db = createDb();
    const [srcRes, oppRes, profileRes] = await Promise.all([
      db.from("job_sources").select("id,kind,board,label,active,last_run_at,last_status,last_count").order("created_at"),
      db.from("opportunities")
        .select("id,title,company,location,work_mode,job_type,salary_text,url,apply_url,source,match_score,matched_skills,missing_skills,required_skills,years_required,strategy,posted_at,created_at,starred")
        .is("dismissed_at", null)
        .order("starred", { ascending: false })
        .order("match_score", { ascending: false, nullsFirst: false })
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(200),
      db.from("profiles").select("years_experience,target_roles").eq("id", OWNER_ID).maybeSingle(),
    ]);
    sources = (srcRes.data ?? []) as SourceItem[];
    candidate = {
      years: profileRes.data?.years_experience ?? null,
      targetRoles: profileRes.data?.target_roles ?? [],
    };
    const opps = oppRes.data ?? [];

    const trackedIds = new Set<string>();
    if (opps.length) {
      const { data: apps } = await db.from("applications")
        .select("opportunity_id").in("opportunity_id", opps.map((o) => o.id));
      for (const a of apps ?? []) if (a.opportunity_id) trackedIds.add(a.opportunity_id);
    }
    jobs = opps.map((o) => ({ ...o, tracked: trackedIds.has(o.id) })) as FeedJob[];
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  const strong = jobs.filter((j) => (j.match_score ?? 0) >= 70).length;
  const lastRun = sources.map((s) => s.last_run_at).filter(Boolean).sort().at(-1);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Job Feed"
        desc="Auto-discovered jobs from your sources, scored against your profile. Star the good ones, dismiss the noise, track the rest into your pipeline."
      />

      {dbError && (
        <InfoBanner>
          Jobs need the <code>0003_job_ingestion.sql</code> migration applied and Supabase env configured. ({dbError})
        </InfoBanner>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="In feed" value={jobs.length} icon={<Briefcase />} />
        <StatCard label="Strong matches" value={strong} hint="70%+ match score" accent />
        <StatCard label="Active sources" value={sources.filter((s) => s.active).length} />
        <StatCard label="Last fetch" value={lastRun ? new Date(lastRun).toLocaleDateString() : "—"} hint={lastRun ? new Date(lastRun).toLocaleTimeString() : "never"} />
      </div>

      <SourceManager sources={sources} />
      <JobFeed jobs={jobs} candidate={candidate} />
    </div>
  );
}
