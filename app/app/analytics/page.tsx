import { getCareerAnalytics, type CareerAnalytics } from "@/lib/domain/careerAnalytics";
import { BarChart, LineChart, FunnelChart } from "@/components/analytics/charts";
import { PageHeader, StatCard, SectionCard, InfoBanner } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let a: CareerAnalytics | null = null;
  let dbError: string | null = null;
  try { a = await getCareerAnalytics(); }
  catch (e) { dbError = e instanceof Error ? e.message : "Database not reachable"; }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" desc="Your job-search funnel, conversion rates, and progress over time." />

      {dbError && <InfoBanner>Data layer not reachable ({dbError}). Charts fill in as you add applications, résumé versions, and practice sessions.</InfoBanner>}

      {/* Headline metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Applications sent" value={a?.applicationsSent ?? 0} href="/app/applications" />
        <StatCard label="Interviews" value={a?.interviewsReceived ?? 0} />
        <StatCard label="Offers" value={a?.offersReceived ?? 0} />
        <StatCard label="Conversion rate" value={`${a?.conversionRate ?? 0}%`} accent hint="offers ÷ applied" />
        <StatCard label="Interview rate" value={`${a?.interviewSuccessRate ?? 0}%`} hint="interviews ÷ applied" />
        <StatCard label="Response rate" value={`${a?.responseRate ?? 0}%`} hint="any reply ÷ applied" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Application funnel" href="/app/applications" cta="Pipeline">
          <FunnelChart data={a?.funnel ?? []} />
        </SectionCard>

        <SectionCard title="Résumé score trend" href="/app/resumes" cta="Résumés" desc="ATS score across résumé versions">
          <LineChart data={a?.resumeScoreTrend ?? []} max={100} emptyLabel="Generate résumé versions to see score progress." />
        </SectionCard>

        <SectionCard title="Skill growth" href="/app/coach" cta="Coach" desc="Cumulative skills over the last 8 weeks">
          <LineChart data={a?.skillGrowthTrend ?? []} emptyLabel="Add skills to your profile to track growth." />
        </SectionCard>

        <SectionCard title="Interview practice" href="/app/interview" cta="Practice" desc="Practice sessions per week">
          <BarChart data={a?.practiceTrend ?? []} emptyLabel="Practice interview answers to see activity." />
        </SectionCard>

        <SectionCard title="Weekly progress" desc="Applications per week (last 8 weeks)">
          <BarChart data={a?.weeklyProgress ?? []} emptyLabel="No applications in the last 8 weeks." />
        </SectionCard>

        <SectionCard title="Monthly progress" desc="Applications per month (last 6 months)">
          <BarChart data={a?.monthlyProgress ?? []} emptyLabel="No applications in the last 6 months." />
        </SectionCard>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {a ? `${a.totals.resumeVersions} résumé versions · ${a.totals.skills} skills · ${a.totals.practiceSessions} practice sessions tracked` : ""}
      </p>
    </div>
  );
}
