import { createDb } from "@/lib/supabase/db";
import { computePipelineAnalytics, STAGES, type PipelineAnalytics } from "@/lib/domain/pipeline";
import type { AppStatus } from "@/lib/supabase/database.types";
import { PageHeader, StatCard, SectionCard, MetricBar, InfoBanner } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  let apps: { id: string; job_title: string | null; company: string | null; status: AppStatus }[] = [];
  let dbError: string | null = null;
  try {
    const db = createDb();
    const { data } = await db.from("applications").select("id,job_title,company,status").order("updated_at", { ascending: false });
    apps = (data ?? []) as typeof apps;
  } catch (e) { dbError = e instanceof Error ? e.message : "Database not reachable"; }

  const a: PipelineAnalytics = computePipelineAnalytics(apps);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Application Pipeline" desc="Eight stages, with a real conversion funnel." />

      {dbError && (
        <InfoBanner>Pipeline data needs the schema applied. The funnel fills in automatically once applications exist.</InfoBanner>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <StatCard label="Applications" value={a.applied} />
        <StatCard label="Active" value={a.active} />
        <StatCard label="Assessment Rate" value={`${a.assessmentRate}%`} />
        <StatCard label="Interview Rate" value={`${a.interviewRate}%`} accent />
        <StatCard label="Offer Rate" value={`${a.offerRate}%`} accent />
      </div>

      {/* Conversion funnel */}
      <SectionCard title="Conversion funnel">
        <div className="space-y-4">
          {([
            ["Applied", a.applied, 100],
            ["Assessment", a.reachedAssessment, a.assessmentRate],
            ["Interview", a.reachedInterview, a.interviewRate],
            ["Offer", a.reachedOffer, a.offerRate],
          ] as const).map(([label, n, p]) => (
            <MetricBar key={label} label={`${label} · ${n}`} value={p} showValue={false} tone="bg-primary" />
          ))}
        </div>
      </SectionCard>

      {/* Stage board */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((s) => (
          <div key={s.key} className="card p-3.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-semibold">{s.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{a.counts[s.key]}</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              {apps.filter((x) => x.status === s.key).slice(0, 6).map((x) => (
                <div key={x.id} className="truncate rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                  {x.job_title ?? "Job"}{x.company ? ` · ${x.company}` : ""}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
