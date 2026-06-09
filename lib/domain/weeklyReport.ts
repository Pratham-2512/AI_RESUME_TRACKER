import "server-only";
import { createDb } from "@/lib/supabase/db";
import { getCareerHealth } from "./careerHealth";
import { buildWeeklyReport, type WeeklyReport } from "./copilotAdvisors";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Weekly report persistence. Reports are stored as `analytics_events` rows
 * (type='weekly_report', props = { overall, report }) — no schema change —
 * which gives a historical timeline for free.
 */

export const EVT_WEEKLY = "weekly_report";

export type SavedReport = { id: string; createdAt: string; overall: number; report: WeeklyReport };

const EMPTY: WeeklyReport = { wins: [], losses: [], progress: [], recommendations: [], funnelNotes: [] };

export async function generateAndSaveWeeklyReport(): Promise<SavedReport> {
  const db = createDb();
  const health = await getCareerHealth();
  const report = buildWeeklyReport(health);
  const { data, error } = await db
    .from("analytics_events")
    .insert({ type: EVT_WEEKLY, feature: "copilot", props: { overall: health.overall, report } as unknown as Json })
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, createdAt: data.created_at, overall: health.overall, report };
}

export async function getWeeklyReportHistory(limit = 8): Promise<SavedReport[]> {
  const db = createDb();
  try {
    const { data } = await db
      .from("analytics_events")
      .select("id,created_at,props")
      .eq("type", EVT_WEEKLY)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => {
      const p = (r.props ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        createdAt: r.created_at,
        overall: typeof p.overall === "number" ? p.overall : 0,
        report: (p.report as WeeklyReport) ?? EMPTY,
      };
    });
  } catch {
    return [];
  }
}
