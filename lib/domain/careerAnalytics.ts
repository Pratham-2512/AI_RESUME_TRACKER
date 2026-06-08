import "server-only";
import { createDb } from "@/lib/supabase/db";
import { computePipelineAnalytics } from "./pipeline";
import type { AppStatus } from "@/lib/supabase/database.types";

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
}

export type TrendPoint = { label: string; value: number };

export type CareerAnalytics = {
  ready: boolean;
  applicationsSent: number;
  interviewsReceived: number;
  offersReceived: number;
  conversionRate: number;       // offers / applied
  interviewSuccessRate: number; // interviews / applied
  responseRate: number;         // any progression past applied
  resumeScoreTrend: TrendPoint[];
  skillGrowthTrend: TrendPoint[];
  weeklyProgress: TrendPoint[]; // applications per week, last 8 weeks
  monthlyProgress: TrendPoint[];// applications per month, last 6 months
  practiceTrend: TrendPoint[];  // interview practice sessions per week
  funnel: { stage: string; count: number }[];
  totals: { resumeVersions: number; skills: number; practiceSessions: number };
};

function weekKey(d: Date): string {
  // ISO-ish week label "MMM D"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function monthKey(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Bucket timestamps into the last `n` weeks (Mondays) and count per bucket. */
function bucketByWeek(timestamps: string[], weeks: number): TrendPoint[] {
  const now = Date.now();
  const out: TrendPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400_000;
    const end = now - i * 7 * 86400_000;
    const count = timestamps.filter((t) => { const x = new Date(t).getTime(); return x >= start && x < end; }).length;
    out.push({ label: weekKey(new Date(end)), value: count });
  }
  return out;
}

function bucketByMonth(timestamps: string[], months: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = timestamps.filter((t) => { const x = new Date(t); return x >= d && x < next; }).length;
    out.push({ label: monthKey(d), value: count });
  }
  return out;
}

export async function getCareerAnalytics(): Promise<CareerAnalytics> {
  const db = createDb();

  const [apps, versions, analyses, skills, practice] = await Promise.all([
    safe(db.from("applications").select("status,created_at"), [] as { status: AppStatus; created_at: string }[]),
    safe(db.from("resume_versions").select("ats_score,created_at").order("created_at", { ascending: true }), [] as { ats_score: number | null; created_at: string }[]),
    safe(db.from("resume_analyses").select("before_score,after_score,created_at").order("created_at", { ascending: true }), [] as { before_score: number | null; after_score: number | null; created_at: string }[]),
    safe(db.from("skills").select("name,created_at").order("created_at", { ascending: true }), [] as { name: string; created_at: string }[]),
    safe(db.from("analytics_events").select("created_at").eq("type", "interview_practice").order("created_at", { ascending: true }), [] as { created_at: string }[]),
  ]);

  const pipeline = computePipelineAnalytics(apps.map((a) => ({ status: a.status })));

  // Resume score trend: prefer version ats_score timeline; fall back to analysis scores.
  let resumeScoreTrend: TrendPoint[] = versions
    .filter((v) => v.ats_score != null)
    .map((v, i) => ({ label: `v${i + 1}`, value: v.ats_score as number }));
  if (resumeScoreTrend.length === 0) {
    resumeScoreTrend = analyses
      .flatMap((a) => [a.before_score, a.after_score].filter((x): x is number => x != null))
      .map((value, i) => ({ label: `#${i + 1}`, value }));
  }

  // Skill growth: cumulative skill count by week (last 8 weeks).
  const skillTimes = skills.map((s) => s.created_at);
  const weeklyNew = bucketByWeek(skillTimes, 8);
  let running = skills.length - weeklyNew.reduce((a, b) => a + b.value, 0);
  const skillGrowthTrend = weeklyNew.map((p) => { running += p.value; return { label: p.label, value: running }; });

  const appTimes = apps.map((a) => a.created_at);

  return {
    ready: true,
    applicationsSent: pipeline.applied,
    interviewsReceived: pipeline.reachedInterview,
    offersReceived: pipeline.reachedOffer,
    conversionRate: pipeline.offerRate,
    interviewSuccessRate: pipeline.interviewRate,
    responseRate: pipeline.applied ? Math.round((pipeline.reachedAssessment / pipeline.applied) * 100) : 0,
    resumeScoreTrend,
    skillGrowthTrend,
    weeklyProgress: bucketByWeek(appTimes, 8),
    monthlyProgress: bucketByMonth(appTimes, 6),
    practiceTrend: bucketByWeek(practice.map((p) => p.created_at), 8),
    funnel: [
      { stage: "Applied", count: pipeline.applied },
      { stage: "Assessment", count: pipeline.reachedAssessment },
      { stage: "Interview", count: pipeline.reachedInterview },
      { stage: "Offer", count: pipeline.reachedOffer },
    ],
    totals: { resumeVersions: versions.length, skills: skills.length, practiceSessions: practice.length },
  };
}
