import "server-only";
import { createDb } from "@/lib/supabase/db";
import { computeReadiness, type PracticeSession, type InterviewReadiness, type QuestionKind } from "./interviewEngine";
import type { Json } from "@/lib/supabase/database.types";

/** Best-effort read of every input the Interview dashboard needs. Tolerates an unapplied/empty schema. */
async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
}

export type RecentSession = {
  kind: QuestionKind;
  question: string;
  overall: number;
  createdAt: string;
};

export type InterviewDashboard = {
  ready: boolean;
  readiness: InterviewReadiness;
  recent: RecentSession[];
  kitCount: number;
  questionCount: number;
  resumes: { id: string; label: string | null }[];
  opportunities: { id: string; title: string; company: string | null }[];
};

const KINDS = new Set<QuestionKind>(["technical", "behavioral", "hr", "project"]);

export async function getInterviewDashboard(): Promise<InterviewDashboard> {
  const db = createDb();

  const [events, kits, questions, resumes, opportunities] = await Promise.all([
    safe(db.from("analytics_events").select("feature,props,created_at").eq("type", "interview_practice").order("created_at", { ascending: false }).limit(200),
      [] as { feature: string | null; props: Json; created_at: string }[]),
    safe(db.from("interview_kits").select("id", { count: "exact" }), [] as { id: string }[]),
    safe(db.from("interview_questions").select("id", { count: "exact" }), [] as { id: string }[]),
    safe(db.from("resumes").select("id,label").order("created_at", { ascending: false }), [] as { id: string; label: string | null }[]),
    safe(db.from("opportunities").select("id,title,company").order("created_at", { ascending: false }).limit(50), [] as { id: string; title: string; company: string | null }[]),
  ]);

  const sessions: PracticeSession[] = [];
  const recent: RecentSession[] = [];
  for (const e of events) {
    const p = (e.props ?? {}) as unknown as Record<string, unknown>;
    const kind = String(p.kind ?? e.feature ?? "") as QuestionKind;
    if (!KINDS.has(kind)) continue;
    const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
    sessions.push({
      kind,
      communication: num("communication"),
      technical: num("technical"),
      confidence: num("confidence"),
      completeness: num("completeness"),
      overall: num("overall"),
      question: typeof p.question === "string" ? p.question : undefined,
      createdAt: e.created_at,
    });
    if (recent.length < 8) {
      recent.push({ kind, question: typeof p.question === "string" ? p.question : "Practice answer", overall: num("overall"), createdAt: e.created_at });
    }
  }

  return {
    ready: true,
    readiness: computeReadiness(sessions),
    recent,
    kitCount: kits.length,
    questionCount: questions.length,
    resumes,
    opportunities,
  };
}
