import { getInterviewDashboard, type InterviewDashboard } from "@/lib/domain/interviewData";
import { InterviewSuite } from "@/components/interview/interview-suite";
import { PageHeader, ScoreRing, MetricBar, SectionCard, StatCard, Empty, Badge, InfoBanner } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR", project: "Project" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function InterviewPage() {
  let d: InterviewDashboard | null = null;
  let dbError: string | null = null;
  try { d = await getInterviewDashboard(); }
  catch (e) { dbError = e instanceof Error ? e.message : "Database not reachable"; }

  const r = d?.readiness;
  const practiced = (r?.sessionCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Interview Prep Suite" desc="Generate tailored questions, practice answers, and track your readiness." />

      {dbError && <InfoBanner>Data layer not reachable ({dbError}). The generator still works; readiness fills in once you practice.</InfoBanner>}

      {/* Readiness dashboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Interview Readiness" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-2">
            <ScoreRing value={r?.overall ?? 0} label={practiced ? "Overall readiness" : "Practice to begin"} size={140} />
            <p className="text-center text-xs text-muted-foreground">
              {practiced ? `${r?.sessionCount} practice ${r?.sessionCount === 1 ? "session" : "sessions"} recorded` : "No practice sessions yet"}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Readiness breakdown" className="lg:col-span-2">
          {practiced ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBar label="Technical" value={r!.technical} />
              <MetricBar label="Behavioral" value={r!.behavioral} />
              <MetricBar label="Project" value={r!.project} />
              <MetricBar label="Communication" value={r!.communication} />
            </div>
          ) : (
            <Empty>Generate a kit below and evaluate a few answers — your technical, behavioral, project, and communication readiness appear here.</Empty>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Kits created" value={d?.kitCount ?? 0} />
            <StatCard label="Questions" value={d?.questionCount ?? 0} />
            <StatCard label="Sessions" value={r?.sessionCount ?? 0} />
            <StatCard label="Overall" value={r?.overall ?? 0} accent />
          </div>
        </SectionCard>
      </div>

      {/* Strong / weak areas */}
      <div className="grid gap-6 sm:grid-cols-2">
        <SectionCard title="Strong areas">
          {r?.strongAreas.length ? (
            <div className="flex flex-wrap gap-2">{r.strongAreas.map((s) => <Badge key={s} tone="ok">{s}</Badge>)}</div>
          ) : <Empty>Score 75+ in a category to mark it strong.</Empty>}
        </SectionCard>
        <SectionCard title="Weak areas">
          {r?.weakAreas.length ? (
            <div className="flex flex-wrap gap-2">{r.weakAreas.map((s) => <Badge key={s} tone="gap">{s}</Badge>)}</div>
          ) : <Empty>{practiced ? "No weak areas — nicely balanced." : "Practice to surface weak areas."}</Empty>}
        </SectionCard>
      </div>

      {/* Recent practice */}
      <SectionCard title="Recent practice sessions">
        {d?.recent.length ? (
          <ul className="divide-y">
            {d.recent.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 inline-block"><Badge tone="neutral">{KIND_LABEL[s.kind] ?? s.kind}</Badge></span>
                  <span className="text-muted-foreground">{s.question}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold">{s.overall}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(s.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>No practice sessions yet. Generate a kit and evaluate an answer.</Empty>}
      </SectionCard>

      {/* Generator + practice */}
      <InterviewSuite resumes={d?.resumes ?? []} opportunities={d?.opportunities ?? []} />
    </div>
  );
}
