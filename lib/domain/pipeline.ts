import type { AppStatus } from "@/lib/supabase/database.types";

export const STAGES: { key: AppStatus; label: string }[] = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "assessment", label: "Assessment" },
  { key: "interview", label: "Interview" },
  { key: "final_round", label: "Final Round" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
  { key: "ghosted", label: "Ghosted" },
];

// Positive progression order (excludes terminal-negative rejected/ghosted).
const PROGRESSION: AppStatus[] = ["applied", "assessment", "interview", "final_round", "offer"];

export type PipelineAnalytics = {
  counts: Record<AppStatus, number>;
  total: number;
  applied: number;        // anything past "saved"
  active: number;         // in-flight (not offer/rejected/ghosted)
  reachedAssessment: number;
  reachedInterview: number;
  reachedOffer: number;
  assessmentRate: number; // % of applied that reached assessment+
  interviewRate: number;  // % of applied that reached interview+
  offerRate: number;      // % of applied that reached offer
};

export function computePipelineAnalytics(apps: { status: AppStatus }[]): PipelineAnalytics {
  const counts = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<AppStatus, number>;
  for (const a of apps) if (a.status in counts) counts[a.status]++;

  const total = apps.length;
  const idx = (s: AppStatus) => PROGRESSION.indexOf(s);
  // "Applied" = sent: applied-or-further, plus terminal outcomes (rejected/ghosted came after applying).
  const applied = apps.filter((a) => a.status !== "saved").length;
  const active = apps.filter((a) => PROGRESSION.includes(a.status) || a.status === "saved").length
    - counts.saved; // in-flight excludes saved + terminal
  const reachedAssessment = apps.filter((a) => idx(a.status) >= idx("assessment")).length;
  const reachedInterview = apps.filter((a) => idx(a.status) >= idx("interview")).length;
  const reachedOffer = counts.offer;

  const pct = (n: number) => (applied ? Math.round((n / applied) * 100) : 0);
  return {
    counts, total, applied,
    active: Math.max(0, active),
    reachedAssessment, reachedInterview, reachedOffer,
    assessmentRate: pct(reachedAssessment),
    interviewRate: pct(reachedInterview),
    offerRate: pct(reachedOffer),
  };
}
