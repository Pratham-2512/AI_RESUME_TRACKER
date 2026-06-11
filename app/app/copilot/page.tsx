import Link from "next/link";
import { Clock, TrendingUp } from "lucide-react";
import { getCareerHealth, type ActionItem, type HealthDimension } from "@/lib/domain/careerHealth";
import { buildWeeklyReport, buildResumeAdvice, buildPhasedPlan } from "@/lib/domain/copilotAdvisors";
import { getCopilotMemory } from "@/lib/domain/copilotMemory";
import { getWeeklyReportHistory } from "@/lib/domain/weeklyReport";
import { CoachChat } from "@/components/coach/coach-chat";
import { MemoryPanel } from "@/components/copilot/memory-panel";
import { SaveWeeklyReport } from "@/components/copilot/weekly-report-actions";
import { PageHeader, SectionCard, StatCard, ScoreRing, MetricBar, Badge, InfoBanner, ErrorBanner } from "@/components/shared/ui";
import { BarChart } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  let health: Awaited<ReturnType<typeof getCareerHealth>> | null = null;
  let memory: Awaited<ReturnType<typeof getCopilotMemory>> | null = null;
  let reportHistory: Awaited<ReturnType<typeof getWeeklyReportHistory>> = [];
  let dbError: string | null = null;
  try {
    [health, memory, reportHistory] = await Promise.all([
      getCareerHealth(),
      getCopilotMemory(),
      getWeeklyReportHistory(8),
    ]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  if (dbError || !health) {
    return (
      <div className="animate-fade-up space-y-6">
        <PageHeader title="Career Copilot" />
        <ErrorBanner>Database not ready{dbError ? `: ${dbError}` : ""}. Apply the schema (see SUPABASE_SETUP.md).</ErrorBanner>
      </div>
    );
  }

  const h = health;
  const report = buildWeeklyReport(h);
  const advice = buildResumeAdvice(h);
  const plan = buildPhasedPlan(h.skillGap);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Career Copilot" desc="Your deterministic command center — built entirely from your own data.">
        <ScoreRing value={h.overall} label="Career Health" size={88} />
      </PageHeader>

      {!h.ready && (
        <InfoBanner>No data yet — add a résumé, profile details, and a few applications and this dashboard fills in automatically.</InfoBanner>
      )}

      {/* Dashboard cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard label="Career Readiness" value={h.overall} hint="of 100" accent />
        <StatCard label="ATS Score" value={h.atsScore ?? "—"} hint={h.atsScore != null ? "of 100" : undefined} />
        <StatCard label="Interview Readiness" value={h.interviewReadiness} hint="of 100" />
        <StatCard label="Applications Sent" value={h.applicationsSent} />
        <StatCard label="Interviews Received" value={h.interviewsReceived} />
        <StatCard label="Offer Rate" value={`${h.offerRate}%`} />
        <StatCard label="Missing Skills" value={h.skillGap.missing.length} />
        <StatCard label="This Week" value={h.weeklyApplications} hint="applications" />
      </section>

      {/* Today's priorities + weekly progress */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Today's priorities" className="lg:col-span-2">
          {h.todaysPriorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">You&apos;re on track — no urgent actions. Keep applying and practicing.</p>
          ) : (
            <ol className="space-y-2">
              {h.todaysPriorities.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
        <SectionCard title="Weekly progress">
          <BarChart data={h.weeklyProgress} emptyLabel="No activity yet this period." />
        </SectionCard>
      </div>

      {/* Career Health Engine — 6 dimensions */}
      <SectionCard title="Career Health Engine" desc={`Overall ${h.overall}/100 · weighted across six dimensions`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {h.dimensions.map((d) => <Dimension key={d.key} d={d} />)}
        </div>
      </SectionCard>

      {/* Action Center */}
      <SectionCard title="Action Center" desc="Dynamic, rule-based recommendations">
        {h.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommended actions right now — you&apos;re all caught up.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {h.actions.map((a, i) => <ActionCard key={i} a={a} />)}
          </div>
        )}
      </SectionCard>

      {/* Advisors */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Résumé advisor" href="/app/resumes" cta="Open studio">
          <AdviceList title="Strengths" items={advice.strengths} tone="good" />
          <AdviceList title="Top problems" items={advice.problems} tone="bad" />
          <AdviceList title="Improvement plan" items={advice.plan} tone="plan" />
        </SectionCard>

        <SectionCard title="Interview advisor" desc={`Readiness ${h.interviewReadiness}/100`} href="/app/interview" cta="Practice">
          <div className="space-y-3">
            {h.interviewBreakdown.map((b) => (
              <MetricBar key={b.label} label={b.label} value={b.value} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Application coach" href="/app/applications" cta="View pipeline">
          {h.funnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet — start applying to build your funnel.</p>
          ) : (
            <>
              <div className="space-y-3">
                {h.funnel.map((f) => {
                  const pct = h.funnel[0].count ? Math.round((f.count / h.funnel[0].count) * 100) : 0;
                  return <MetricBar key={f.stage} label={`${f.stage} · ${f.count}`} value={pct} />;
                })}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {report.funnelNotes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            </>
          )}
        </SectionCard>

        <SectionCard title="Skill gap coach" desc={`Target: ${h.skillGap.targetRoleLabel} · ${h.skillGap.coverage}% covered`} href="/app/coach" cta="Open coach">
          {h.skillGap.missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skill gaps for this role — strong coverage.</p>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold">Priority skills</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {h.skillGap.missing.slice(0, 8).map((m) => (
                  <Badge key={m.skill} tone="gap">{m.skill} · {m.demand}</Badge>
                ))}
              </div>
              <div className="space-y-2">
                {plan.map((phase) => (
                  <div key={phase.label} className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-sm font-semibold">{phase.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{phase.skills.length ? phase.skills.join(", ") : "Consolidate & build a portfolio project"}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Copilot Memory */}
      {memory && (
        <SectionCard title="Copilot memory" desc="Persisted career goal, learning progress, and coaching context the chat recalls">
          <MemoryPanel memory={memory} />
        </SectionCard>
      )}

      {/* Smart Chat Copilot (rule-based, persisted to coaching_sessions/messages) */}
      <SectionCard title="Smart chat copilot" desc="Rule-based — grounded in your data + memory, no LLM required">
        <CoachChat />
      </SectionCard>

      {/* Weekly Report */}
      <SectionCard title="Weekly report" desc="Auto-generated from this week's activity">
        <div className="mb-4"><SaveWeeklyReport /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReportColumn title="Wins" items={report.wins} tone="good" />
          <ReportColumn title="Watch-outs" items={report.losses} tone="bad" />
          <ReportColumn title="Progress" items={report.progress} tone="plan" />
          <ReportColumn title="Recommendations" items={report.recommendations} tone="plan" />
        </div>

        {reportHistory.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Report timeline</p>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {reportHistory.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <Badge tone="primary">Health {r.overall}</Badge>
                  </div>
                  {r.report.recommendations[0] && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.report.recommendations[0]}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------------- presentational pieces (server components) ---------------- */

function Dimension({ d }: { d: HealthDimension }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <MetricBar label={d.label} value={d.score} />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.detail}</p>
    </div>
  );
}

const PRIORITY_TONE = { high: "gap", medium: "warn", low: "neutral" } as const;

function ActionCard({ a }: { a: ActionItem }) {
  return (
    <Link href={a.href} className="group block rounded-xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{a.title}</span>
        <Badge tone={PRIORITY_TONE[a.priority]} className="uppercase tracking-wide">{a.priority}</Badge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.reason}</p>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {a.impact}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {a.effort} effort</span>
      </div>
    </Link>
  );
}

const TONE: Record<string, string> = { good: "text-success", bad: "text-destructive", plan: "text-muted-foreground" };

function AdviceList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className={`text-sm leading-relaxed ${TONE[tone]}`}>• {it}</li>)}
      </ul>
    </div>
  );
}

function ReportColumn({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">{items.map((it, i) => <li key={i} className={`text-sm leading-relaxed ${TONE[tone]}`}>• {it}</li>)}</ul>
      )}
    </div>
  );
}
