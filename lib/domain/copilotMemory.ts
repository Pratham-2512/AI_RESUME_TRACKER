import "server-only";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { roleLabel } from "./skillData";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Copilot Memory — persistent career context the chat/advisors can recall.
 * No schema changes: career goal + target role live on `profiles`; learning
 * progress and a rolling coaching-context note are stored as `analytics_events`
 * rows (props jsonb). Reads are best-effort so an empty schema returns defaults.
 */

export const EVT_LEARNING = "learning_progress";
export const EVT_MEMORY = "copilot_memory";

async function safe<T>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> {
  try { const { data } = await p; return data ?? fallback; } catch { return fallback; }
}

export type LearningEntry = { skill: string; status: "started" | "in_progress" | "completed"; at: string; note?: string };

export type CopilotMemory = {
  careerGoal: string | null;
  targetRole: string | null;
  targetRoleLabel: string;
  yearsExperience: number | null;
  learning: LearningEntry[];
  recentTopics: string[];
  lastInteractionAt: string | null;
  sessionCount: number;
  contextNote: string | null;
};

const STATUS = new Set(["started", "in_progress", "completed"]);

export async function getCopilotMemory(): Promise<CopilotMemory> {
  const db = createDb();
  const [profile, learnEvents, memEvents, messages, sessions] = await Promise.all([
    safe(db.from("profiles").select("career_goals,target_roles,years_experience").eq("id", OWNER_ID).maybeSingle(),
      null as null | { career_goals: string | null; target_roles: string[] | null; years_experience: number | null }),
    safe(db.from("analytics_events").select("props,created_at").eq("type", EVT_LEARNING).order("created_at", { ascending: false }).limit(100),
      [] as { props: Json; created_at: string }[]),
    safe(db.from("analytics_events").select("props,created_at").eq("type", EVT_MEMORY).order("created_at", { ascending: false }).limit(1),
      [] as { props: Json; created_at: string }[]),
    safe(db.from("coaching_messages").select("role,content,created_at").eq("role", "user").order("created_at", { ascending: false }).limit(10),
      [] as { role: string; content: string; created_at: string }[]),
    safe(db.from("coaching_sessions").select("id"), [] as { id: string }[]),
  ]);

  // Dedupe learning entries by skill, keeping the most recent status.
  const seen = new Set<string>();
  const learning: LearningEntry[] = [];
  for (const e of learnEvents) {
    const p = (e.props ?? {}) as Record<string, unknown>;
    const skill = typeof p.skill === "string" ? p.skill : null;
    const status = typeof p.status === "string" && STATUS.has(p.status) ? (p.status as LearningEntry["status"]) : "started";
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    learning.push({ skill, status, at: e.created_at, note: typeof p.note === "string" ? p.note : undefined });
  }

  const recentTopics = messages.map((m) => m.content.slice(0, 60)).slice(0, 5);
  const lastInteractionAt = messages[0]?.created_at ?? null;
  const memProps = (memEvents[0]?.props ?? null) as Record<string, unknown> | null;
  const contextNote = memProps && typeof memProps.note === "string" ? memProps.note : null;
  const targetRole = profile?.target_roles?.[0] ?? null;

  return {
    careerGoal: profile?.career_goals ?? null,
    targetRole,
    targetRoleLabel: roleLabel(targetRole),
    yearsExperience: profile?.years_experience ?? null,
    learning,
    recentTopics,
    lastInteractionAt,
    sessionCount: sessions.length,
    contextNote,
  };
}

/** Persist the user's career goal + target role onto the profile (memory). */
export async function persistCareerGoal(opts: { goal?: string; targetRole?: string }): Promise<void> {
  const db = createDb();
  const patch: { career_goals?: string; target_roles?: string[] } = {};
  if (opts.goal != null && opts.goal.trim()) patch.career_goals = opts.goal.trim().slice(0, 2000);
  if (opts.targetRole != null && opts.targetRole.trim()) patch.target_roles = [opts.targetRole.trim()];
  if (!Object.keys(patch).length) return;
  const { error } = await db.from("profiles").update(patch).eq("id", OWNER_ID);
  if (error) throw new Error(error.message);
}

/** Record a learning-progress event (start / progress / completion of a skill). */
export async function persistLearningProgress(opts: { skill: string; status: LearningEntry["status"]; note?: string }): Promise<void> {
  const db = createDb();
  const { error } = await db.from("analytics_events").insert({
    type: EVT_LEARNING,
    feature: opts.status,
    props: { skill: opts.skill.slice(0, 120), status: opts.status, note: opts.note?.slice(0, 500) ?? null } as Json,
  });
  if (error) throw new Error(error.message);
}

/** Roll the latest coaching context into a memory note the copilot can recall. */
export async function persistCoachingContext(opts: { note: string; topics?: string[] }): Promise<void> {
  const db = createDb();
  await db.from("analytics_events").insert({
    type: EVT_MEMORY,
    feature: "context",
    props: { note: opts.note.slice(0, 1000), topics: (opts.topics ?? []).slice(0, 8) } as Json,
  });
}
