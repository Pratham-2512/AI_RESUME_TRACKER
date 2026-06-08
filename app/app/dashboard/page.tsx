import Link from "next/link";
import { getCommandCenter, type CommandCenter } from "@/lib/domain/commandCenter";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  let cc: CommandCenter | null = null;
  let dbError: string | null = null;
  try {
    cc = await getCommandCenter();
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Career Command Center</h1>
          <p className="mt-1 text-muted-foreground">Everything that matters today, in one place.</p>
        </div>
        <Link href="/app/copilot" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Ask the Coach</Link>
      </div>

      {(dbError || cc?.ready === false) && (
        <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          Data layer not populated yet{dbError ? ` (${dbError})` : ""}. Apply the schema and add your profile/résumé — every widget below fills in automatically.
        </div>
      )}

      {/* Top metric strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Résumé Health" value={fmt(cc?.resumeHealth)} accent />
        <Stat label="ATS Score" value={fmt(cc?.atsScore)} />
        <Stat label="Applied (7d)" value={cc?.applicationsThisWeek ?? 0} />
        <Stat label="Interview Rate" value={`${cc?.interviewRate ?? 0}%`} />
        <Stat label="Offer Rate" value={`${cc?.offerRate ?? 0}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left column — action */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Today's Priority Jobs" href="/app/matches" cta="View matches">
            {cc?.priorityJobs.length ? (
              <ul className="space-y-2">
                {cc.priorityJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>{j.title}{j.company ? ` · ${j.company}` : ""}</span>
                    <span className="font-semibold text-primary">{j.score ?? "—"}%</span>
                  </li>
                ))}
              </ul>
            ) : <Empty>No scored matches yet. Add your profile + jobs, then run matching.</Empty>}
          </Card>

          <Card title="AI Career Coach" href="/app/copilot" cta="Open coach">
            <ul className="space-y-2">
              {(cc?.coach ?? []).map((c, i) => (
                <li key={i} className="flex gap-3 rounded-md bg-muted p-3 text-sm">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${c.priority === "high" ? "bg-destructive" : c.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                  <span>{c.text} {c.href && <Link href={c.href} className="text-primary hover:underline">→</Link>}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Recommended Learning Tasks" href="/app/skills" cta="See roadmap">
            {cc?.learningTasks.length ? (
              <ul className="space-y-1.5 text-sm">
                {cc.learningTasks.map((t, i) => (
                  <li key={i} className="flex items-center gap-2"><input type="checkbox" className="rounded" disabled /> {t}</li>
                ))}
              </ul>
            ) : <Empty>Run a skill-gap analysis to generate a weekly plan.</Empty>}
          </Card>
        </div>

        {/* Right column — signal */}
        <div className="space-y-6">
          <Card title="Top Skill Gaps" href="/app/skills" cta="Analyze">
            {cc?.topSkillGaps.length ? (
              <div className="flex flex-wrap gap-2">
                {cc.topSkillGaps.map((s) => <span key={s} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">{s}</span>)}
              </div>
            ) : <Empty>No gaps detected yet.</Empty>}
          </Card>

          <Card title="Market Demand Trends" href="/app/jobs" cta="Browse jobs">
            {cc?.marketTrends.length ? (
              <ul className="space-y-1.5 text-sm">
                {cc.marketTrends.map((m) => (
                  <li key={m.skill}>
                    <div className="flex justify-between"><span>{m.skill}</span><span className="text-muted-foreground">{m.count}</span></div>
                    <div className="mt-1 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.min(100, (m.count / (cc.marketTrends[0].count || 1)) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <Empty>Ingest jobs to see what the market wants.</Empty>}
          </Card>

          <Card title="Funnel" href="/app/applications" cta="Pipeline">
            <div className="text-sm text-muted-foreground">
              <p>{cc?.totalApplications ?? 0} total applications</p>
              <p className="mt-1">{cc?.interviewRate ?? 0}% interview · {cc?.offerRate ?? 0}% offer</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number | null | undefined) { return n == null ? "—" : n; }

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Card({ title, href, cta, children }: { title: string; href: string; cta: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-xs text-primary hover:underline">{cta} →</Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{children}</p>;
}
