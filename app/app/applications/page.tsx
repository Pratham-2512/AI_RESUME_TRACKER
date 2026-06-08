import { createDb } from "@/lib/supabase/db";
import { computePipelineAnalytics, STAGES, type PipelineAnalytics } from "@/lib/domain/pipeline";
import type { AppStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const db = createDb();
  let apps: { id: string; job_title: string | null; company: string | null; status: AppStatus }[] = [];
  let dbError: string | null = null;
  try {
    const { data } = await db.from("applications").select("id,job_title,company,status").order("updated_at", { ascending: false });
    apps = (data ?? []) as typeof apps;
  } catch (e) { dbError = e instanceof Error ? e.message : "Database not reachable"; }

  const a: PipelineAnalytics = computePipelineAnalytics(apps);

  return (
    <div>
      <h1 className="text-2xl font-bold">Application Pipeline</h1>
      <p className="mt-1 text-muted-foreground">Eight stages, with a real conversion funnel.</p>

      {dbError && (
        <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          Pipeline data needs the schema applied. The funnel fills in automatically once applications exist.
        </div>
      )}

      {/* Analytics */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Metric label="Applications" value={a.applied} />
        <Metric label="Active" value={a.active} />
        <Metric label="Assessment Rate" value={`${a.assessmentRate}%`} />
        <Metric label="Interview Rate" value={`${a.interviewRate}%`} accent />
        <Metric label="Offer Rate" value={`${a.offerRate}%`} accent />
      </div>

      {/* Conversion funnel */}
      <div className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="mb-3 font-semibold">Conversion funnel</h2>
        <Funnel a={a} />
      </div>

      {/* Stage board */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {STAGES.map((s) => (
          <div key={s.key} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{s.label}</span>
              <span className="rounded-full bg-muted px-1.5 text-xs">{a.counts[s.key]}</span>
            </div>
            <div className="mt-2 space-y-1">
              {apps.filter((x) => x.status === s.key).slice(0, 6).map((x) => (
                <div key={x.id} className="truncate rounded bg-muted/60 px-2 py-1 text-xs">
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

function Metric({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Funnel({ a }: { a: PipelineAnalytics }) {
  const rows = [
    ["Applied", a.applied, 100],
    ["Assessment", a.reachedAssessment, a.assessmentRate],
    ["Interview", a.reachedInterview, a.interviewRate],
    ["Offer", a.reachedOffer, a.offerRate],
  ] as const;
  return (
    <div className="space-y-2">
      {rows.map(([label, n, p]) => (
        <div key={label}>
          <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{n} · {p}%</span></div>
          <div className="mt-1 h-3 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${Math.max(2, p)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
