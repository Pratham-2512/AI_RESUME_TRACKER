import Link from "next/link";
import { getCareerHealth, type ActionItem, type HealthDimension } from "@/lib/domain/careerHealth";
import { buildWeeklyReport, buildResumeAdvice, buildPhasedPlan } from "@/lib/domain/copilotAdvisors";
import { getCopilotMemory } from "@/lib/domain/copilotMemory";
import { getWeeklyReportHistory } from "@/lib/domain/weeklyReport";
import { CoachChat } from "@/components/coach/coach-chat";
import { MemoryPanel } from "@/components/copilot/memory-panel";
import { SaveWeeklyReport } from "@/components/copilot/weekly-report-actions";

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
      <div>
        <h1 className="text-2xl font-bold">Career Copilot</h1>
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Database not ready{dbError ? `: ${dbError}` : ""}. Apply the schema (see SUPABASE_SETUP.md).
        </div>
      </div>
    );
  }

  const h = health;
  const report = buildWeeklyReport(h);
  const advice = buildResumeAdvice(h);
  const plan = buildPhasedPlan(h.skillGap);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Career Copilot</h1>
          <p className="mt-1 text-muted-foreground">Your deterministic command center — built entirely from your own data.</p>
        </div>
        <Ring value={h.overall} label="Career Health" />
      </div>

      {!h.ready && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          No data yet — add a résumé, profile details, and a few applications and this dashboard fills in automatically.
        </div>
      )}

      {/* Dashboard cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Career Readiness" value={h.overall} suffix="/100" accent />
        <Stat label="ATS Score" value={h.atsScore ?? "—"} suffix={h.atsScore != null ? "/100" : ""} />
        <Stat label="Interview Readiness" value={h.interviewReadiness} suffix="/100" />
        <Stat label="Applications Sent" value={h.applicationsSent} />
        <Stat label="Interviews Received" value={h.interviewsReceived} />
        <Stat label="Offer Rate" value={`${h.offerRate}%`} />
        <Stat label="Missing Skills" value={h.skillGap.missing.length} />
        <Stat label="This Week" value={h.weeklyApplications} suffix=" apps" />
      </section>

      {/* Today's priorities + weekly progress */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Today’s Priorities" className="lg:col-span-2">
          {h.todaysPriorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">You’re on track — no urgent actions. Keep applying and practicing.</p>
          ) : (
            <ol className="space-y-2">
              {h.todaysPriorities.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md border bg-background p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Weekly Progress">
          <BarChart data={h.weeklyProgress} />
        </Card>
      </div>

      {/* Career Health Engine — 6 dimensions */}
      <Card title="Career Health Engine" subtitle={`Overall ${h.overall}/100 · weighted across six dimensions`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {h.dimensions.map((d) => <DimensionBar key={d.key} d={d} />)}
        </div>
      </Card>

      {/* Action Center */}
      <Card title="Action Center" subtitle="Dynamic, rule-based recommendations">
        {h.actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommended actions right now. 🎉</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {h.actions.map((a, i) => <ActionCard key={i} a={a} />)}
          </div>
        )}
      </Card>

      {/* Advisors */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resume Advisor */}
        <Card title="Résumé Advisor">
          <AdviceList title="Strengths" items={advice.strengths} tone="good" />
          <AdviceList title="Top problems" items={advice.problems} tone="bad" />
          <AdviceList title="Improvement plan" items={advice.plan} tone="plan" />
          <Link href="/app/resumes" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Open résumé studio →</Link>
        </Card>

        {/* Interview Advisor */}
        <Card title="Interview Advisor" subtitle={`Readiness ${h.interviewReadiness}/100`}>
          <div className="space-y-3">
            {h.interviewBreakdown.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-sm"><span>{b.label}</span><span className="text-muted-foreground">{b.value}/100</span></div>
                <Bar value={b.value} />
              </div>
            ))}
          </div>
          <Link href="/app/interview" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Practice interviews →</Link>
        </Card>

        {/* Application Coach */}
        <Card title="Application Coach">
          {h.funnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet — start applying to build your funnel.</p>
          ) : (
            <>
              <div className="space-y-2">
                {h.funnel.map((f) => {
                  const pct = h.funnel[0].count ? Math.round((f.count / h.funnel[0].count) * 100) : 0;
                  return (
                    <div key={f.stage}>
                      <div className="flex justify-between text-sm"><span>{f.stage}</span><span className="text-muted-foreground">{f.count} · {pct}%</span></div>
                      <Bar value={pct} />
                    </div>
                  );
                })}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {report.funnelNotes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            </>
          )}
          <Link href="/app/applications" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">View pipeline →</Link>
        </Card>

        {/* Skill Gap Coach */}
        <Card title="Skill Gap Coach" subtitle={`Target: ${h.skillGap.targetRoleLabel} · ${h.skillGap.coverage}% covered`}>
          {h.skillGap.missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skill gaps for this role — strong coverage.</p>
          ) : (
            <>
              <p className="mb-1.5 text-sm font-semibold">Priority skills</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {h.skillGap.missing.slice(0, 8).map((m) => (
                  <span key={m.skill} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">{m.skill} · {m.demand}</span>
                ))}
              </div>
              <div className="space-y-2">
                {plan.map((phase) => (
                  <div key={phase.label} className="rounded-md border bg-background p-3">
                    <p className="text-sm font-semibold">{phase.label}</p>
                    <p className="text-sm text-muted-foreground">{phase.skills.length ? phase.skills.join(", ") : "Consolidate & build a portfolio project"}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link href="/app/coach" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Open coach →</Link>
        </Card>
      </div>

      {/* Copilot Memory */}
      {memory && (
        <Card title="Copilot Memory" subtitle="Persisted career goal, learning progress, and coaching context the chat recalls">
          <MemoryPanel memory={memory} />
        </Card>
      )}

      {/* Smart Chat Copilot (rule-based, persisted to coaching_sessions/messages) */}
      <Card title="Smart Chat Copilot" subtitle="Rule-based — grounded in your data + memory, no LLM required">
        <CoachChat />
      </Card>

      {/* Weekly Report */}
      <Card title="Weekly Report" subtitle="Auto-generated from this week’s activity">
        <div className="mb-3"><SaveWeeklyReport /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReportColumn title="Wins" items={report.wins} tone="good" />
          <ReportColumn title="Watch-outs" items={report.losses} tone="bad" />
          <ReportColumn title="Progress" items={report.progress} tone="plan" />
          <ReportColumn title="Recommendations" items={report.recommendations} tone="plan" />
        </div>

        {reportHistory.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-sm font-semibold">Report timeline</p>
            <ol className="relative space-y-3 border-l pl-4">
              {reportHistory.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[1.30rem] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Health {r.overall}</span>
                  </div>
                  {r.report.recommendations[0] && <p className="text-xs text-muted-foreground">{r.report.recommendations[0]}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- presentational pieces (server components) ---------------- */

function Stat({ label, value, suffix, accent }: { label: string; value: React.ReactNode; suffix?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}<span className="text-sm font-normal text-muted-foreground">{suffix}</span></p>
    </div>
  );
}

function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className ?? ""}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function barColor(v: number) {
  return v >= 75 ? "bg-emerald-500" : v >= 50 ? "bg-primary" : v >= 30 ? "bg-amber-500" : "bg-destructive";
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-2 w-full rounded-full bg-muted">
      <div className={`h-2 rounded-full ${barColor(value)}`} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}

function DimensionBar({ d }: { d: HealthDimension }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{d.label}</span>
        <span className="text-sm font-bold">{d.score}</span>
      </div>
      <Bar value={d.score} />
      <p className="mt-1 text-xs text-muted-foreground">{d.detail}</p>
    </div>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const deg = Math.round((value / 100) * 360);
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(hsl(var(--primary)) ${deg}deg, hsl(var(--muted)) ${deg}deg)` }}
      >
        <div className="flex items-center justify-center rounded-full bg-card" style={{ height: "3.75rem", width: "3.75rem" }}>
          <span className="text-xl font-bold">{value}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? "4px" : "0" }} title={`${d.value}`} />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const PRIORITY_BADGE: Record<ActionItem["priority"], string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

function ActionCard({ a }: { a: ActionItem }) {
  return (
    <Link href={a.href} className="block rounded-lg border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/40">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{a.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_BADGE[a.priority]}`}>{a.priority}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{a.reason}</p>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span>📈 {a.impact}</span>
        <span>⏱ {a.effort} effort</span>
      </div>
    </Link>
  );
}

const TONE: Record<string, string> = { good: "text-emerald-600 dark:text-emerald-400", bad: "text-destructive", plan: "text-muted-foreground" };

function AdviceList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => <li key={i} className={`text-sm ${TONE[tone]}`}>• {it}</li>)}
      </ul>
    </div>
  );
}

function ReportColumn({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1">{items.map((it, i) => <li key={i} className={`text-sm ${TONE[tone]}`}>• {it}</li>)}</ul>
      )}
    </div>
  );
}
