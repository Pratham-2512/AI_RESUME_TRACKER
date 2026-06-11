import Link from "next/link";
import {
  Activity, ScanSearch, Send, MessagesSquare, Trophy, Clock,
  ArrowRight, Circle, GraduationCap, Briefcase, TrendingUp,
} from "lucide-react";
import { getCommandCenter, type CommandCenter } from "@/lib/domain/commandCenter";
import { getCareerHealth, type ActionItem } from "@/lib/domain/careerHealth";
import { PageHeader, SectionCard, StatCard, Empty, InfoBanner, Badge, MetricBar } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

const EFFORT_MIN: Record<ActionItem["effort"], string> = { low: "15 min", medium: "30 min", high: "60 min" };

export default async function CommandCenterPage() {
  let cc: CommandCenter | null = null;
  let mission: ActionItem[] = [];
  let dbError: string | null = null;
  try {
    const [center, health] = await Promise.all([getCommandCenter(), getCareerHealth()]);
    cc = center;
    mission = health.actions.slice(0, 4);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Career Command Center" desc="Everything that matters today, in one place.">
        <Link href="/app/coach" className="btn-primary">
          <MessagesSquare className="h-4 w-4" />
          Ask the Coach
        </Link>
      </PageHeader>

      {(dbError || cc?.ready === false) && (
        <InfoBanner>
          Data layer not populated yet{dbError ? ` (${dbError})` : ""}. Apply the schema and add your profile/résumé — every widget below fills in automatically.
        </InfoBanner>
      )}

      {/* Top metric strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Résumé Health" value={fmt(cc?.resumeHealth)} accent icon={<Activity />} />
        <StatCard label="ATS Score" value={fmt(cc?.atsScore)} icon={<ScanSearch />} />
        <StatCard label="Applied (7d)" value={cc?.applicationsThisWeek ?? 0} icon={<Send />} />
        <StatCard label="Interview Rate" value={`${cc?.interviewRate ?? 0}%`} icon={<MessagesSquare />} />
        <StatCard label="Offer Rate" value={`${cc?.offerRate ?? 0}%`} icon={<Trophy />} />
      </div>

      {/* Today's mission — action over passivity */}
      {mission.length > 0 && (
        <section className="card relative overflow-hidden p-5 sm:p-6">
          <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-primary/30" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Today&apos;s mission</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">The highest-impact moves right now</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3 w-3" />
              {mission.length} actions · est. {mission.reduce((a, m) => a + (m.effort === "low" ? 15 : m.effort === "medium" ? 30 : 60), 0)} min
            </span>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {mission.map((m, i) => (
              <li key={i}>
                <Link
                  href={m.href}
                  className="group flex h-full items-start gap-3 rounded-xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{m.reason}</span>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {EFFORT_MIN[m.effort]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — action */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Today's priority jobs" href="/app/opportunities" cta="View matches">
            {cc?.priorityJobs.length ? (
              <ul className="space-y-2">
                {cc.priorityJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm transition-colors hover:border-primary/30">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="truncate font-medium">{j.title}{j.company ? <span className="font-normal text-muted-foreground"> · {j.company}</span> : ""}</span>
                    </span>
                    <Badge tone={j.score != null && j.score >= 70 ? "ok" : "primary"}>{j.score ?? "—"}% match</Badge>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<Briefcase />}>No scored matches yet. Add your profile + jobs, then run matching.</Empty>}
          </SectionCard>

          <SectionCard title="AI career coach" href="/app/coach" cta="Open coach">
            <ul className="space-y-2">
              {(cc?.coach ?? []).map((c, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm leading-relaxed">
                  <Circle className={`mt-1.5 h-2 w-2 shrink-0 fill-current ${c.priority === "high" ? "text-destructive" : c.priority === "medium" ? "text-warning" : "text-muted-foreground"}`} strokeWidth={0} />
                  <span>{c.text} {c.href && <Link href={c.href} className="font-medium text-primary hover:underline">Take action →</Link>}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Recommended learning" href="/app/coach" cta="See roadmap">
            {cc?.learningTasks.length ? (
              <ul className="space-y-2 text-sm">
                {cc.learningTasks.map((t, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <GraduationCap className="h-4 w-4 shrink-0 text-secondary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<GraduationCap />}>Run a skill-gap analysis to generate a weekly plan.</Empty>}
          </SectionCard>
        </div>

        {/* Right column — signal */}
        <div className="space-y-6">
          <SectionCard title="Top skill gaps" href="/app/coach" cta="Analyze">
            {cc?.topSkillGaps.length ? (
              <div className="flex flex-wrap gap-1.5">
                {cc.topSkillGaps.map((s) => <Badge key={s} tone="gap">{s}</Badge>)}
              </div>
            ) : <Empty>No gaps detected yet.</Empty>}
          </SectionCard>

          <SectionCard title="Market demand" desc="What employers ask for most" href="/app/opportunities" cta="Browse jobs">
            {cc?.marketTrends.length ? (
              <div className="space-y-3">
                {cc.marketTrends.map((m) => (
                  <MetricBar
                    key={m.skill}
                    label={m.skill}
                    value={Math.min(100, (m.count / (cc.marketTrends[0].count || 1)) * 100)}
                    showValue={false}
                    tone="bg-secondary"
                  />
                ))}
              </div>
            ) : <Empty icon={<TrendingUp />}>Ingest jobs to see what the market wants.</Empty>}
          </SectionCard>

          <SectionCard title="Funnel" href="/app/applications" cta="Pipeline">
            <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
              <p><span className="font-semibold tabular-nums text-foreground">{cc?.totalApplications ?? 0}</span> total applications</p>
              <p><span className="font-semibold tabular-nums text-foreground">{cc?.interviewRate ?? 0}%</span> interview · <span className="font-semibold tabular-nums text-foreground">{cc?.offerRate ?? 0}%</span> offer</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number | null | undefined) { return n == null ? "—" : n; }
