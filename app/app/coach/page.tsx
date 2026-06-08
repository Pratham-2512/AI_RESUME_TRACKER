import { getCoachDashboard, type CoachDashboard } from "@/lib/domain/coachData";
import { ROLE_SKILLS, roleLabel } from "@/lib/domain/skillData";
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { CoachChat } from "@/components/coach/coach-chat";
import { PageHeader, ScoreRing, MetricBar, SectionCard, StatCard, Badge, Chips, Empty, InfoBanner } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = Object.keys(ROLE_SKILLS).map((value) => ({ value, label: roleLabel(value) }));
const PRIORITY_TONE = { high: "gap", medium: "warn", low: "neutral" } as const;

export default async function CoachPage() {
  let d: CoachDashboard | null = null;
  let dbError: string | null = null;
  try { d = await getCoachDashboard(); }
  catch (e) { dbError = e instanceof Error ? e.message : "Database not reachable"; }

  const r = d?.readiness;

  return (
    <div className="space-y-6">
      <PageHeader title="Career Coach" desc="Skill-gap analysis, a 90-day roadmap, readiness, and a grounded coach." />

      {dbError && <InfoBanner>Data layer not reachable ({dbError}). Add your profile, skills, and a target role to populate the coach.</InfoBanner>}
      {d && !dbError && d.skillCount === 0 && (
        <InfoBanner>No skills on your profile yet — the coach defaults to a Full-Stack target. Add skills and a target role in your Profile for personalized analysis.</InfoBanner>
      )}

      {/* Career readiness */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Career Readiness">
          <div className="flex flex-col items-center gap-2">
            <ScoreRing value={r?.overall ?? 0} label="Overall readiness" size={140} />
            {r?.weakest && <p className="text-center text-xs text-muted-foreground">Weakest area: <span className="font-medium text-foreground">{r.weakest.key}</span> ({r.weakest.value})</p>}
          </div>
        </SectionCard>

        <SectionCard title="Readiness breakdown" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricBar label="Résumé" value={r?.resume ?? 0} />
            <MetricBar label="Interview" value={r?.interview ?? 0} />
            <MetricBar label="Skills" value={r?.skills ?? 0} />
            <MetricBar label="Projects" value={r?.projects ?? 0} />
            <MetricBar label="Applications" value={r?.applications ?? 0} />
          </div>
        </SectionCard>
      </div>

      {/* Current skills · target role · recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Current skills" className="lg:col-span-1">
          <Chips items={(d?.candidateSkills ?? []).slice(0, 24)} tone="primary" empty="No skills on your profile yet." />
        </SectionCard>

        <SectionCard title="Target role" className="lg:col-span-1">
          <p className="text-lg font-bold">{d?.targetRoleLabel ?? "—"}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard label="Skill coverage" value={`${d?.gap.coverage ?? 0}%`} accent />
            <StatCard label="Gaps to close" value={d?.gap.missing.length ?? 0} />
          </div>
        </SectionCard>

        <SectionCard title="Recommendations" href="/app/interview" cta="Prep" className="lg:col-span-1">
          {d?.recommendations.length ? (
            <ul className="space-y-2">
              {d.recommendations.slice(0, 5).map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge tone={PRIORITY_TONE[rec.priority]}>{rec.priority}</Badge>
                  <span>{rec.text}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>No recommendations yet.</Empty>}
        </SectionCard>
      </div>

      {/* Skill gap + roadmap (interactive) */}
      {d && <CoachWorkspace initialGap={d.gap} initialRoadmap={d.roadmap} roleOptions={ROLE_OPTIONS} />}

      {/* Goals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Weekly goals" desc="Your first 30 days, week by week">
          {d?.weeklyGoals.length ? (
            <ul className="space-y-1.5 text-sm">
              {d.weeklyGoals.map((g, i) => (
                <li key={i} className="flex items-center gap-2"><input type="checkbox" className="rounded" disabled /> {g}</li>
              ))}
            </ul>
          ) : <Empty>Set a target role to generate goals.</Empty>}
        </SectionCard>
        <SectionCard title="Monthly goals" desc="90-day phase outcomes">
          {d?.monthlyGoals.length ? (
            <ul className="space-y-2 text-sm">
              {d.monthlyGoals.map((g, i) => (
                <li key={i}>
                  <p className="font-medium">{g.label}</p>
                  <p className="text-xs text-muted-foreground">{g.detail}</p>
                </li>
              ))}
            </ul>
          ) : <Empty>Set a target role to generate goals.</Empty>}
        </SectionCard>
      </div>

      {/* Coach chat */}
      <CoachChat />
    </div>
  );
}
