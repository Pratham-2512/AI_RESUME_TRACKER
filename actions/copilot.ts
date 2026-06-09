"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { persistCareerGoal, persistLearningProgress } from "@/lib/domain/copilotMemory";
import { generateAndSaveWeeklyReport, type SavedReport } from "@/lib/domain/weeklyReport";

const goalSchema = z.object({
  goal: z.string().trim().max(2000).optional(),
  targetRole: z.string().trim().max(120).optional(),
});

/** Persist the user's career goal + target role (Copilot Memory). */
export async function saveCareerGoal(input: unknown): Promise<void> {
  const { goal, targetRole } = goalSchema.parse(input);
  await persistCareerGoal({ goal, targetRole });
  revalidatePath("/app/copilot");
}

const progressSchema = z.object({
  skill: z.string().trim().min(1).max(120),
  status: z.enum(["started", "in_progress", "completed"]),
  note: z.string().trim().max(500).optional(),
});

/** Record progress on a skill (Copilot Memory). */
export async function recordLearningProgress(input: unknown): Promise<void> {
  const { skill, status, note } = progressSchema.parse(input);
  await persistLearningProgress({ skill, status, note });
  revalidatePath("/app/copilot");
}

/** Generate this week's report and persist it to the timeline. */
export async function generateWeeklyReport(): Promise<SavedReport> {
  const saved = await generateAndSaveWeeklyReport();
  revalidatePath("/app/copilot");
  return saved;
}
