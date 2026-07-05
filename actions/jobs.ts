"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDb } from "@/lib/supabase/db";
import { ingestAllSources, type IngestSummary } from "@/lib/jobs/ingest";
import { snapshotResumeVersion } from "@/lib/resume/versioning";
import type { JobSourceKind } from "@/lib/supabase/database.types";

const sourceSchema = z.object({
  kind: z.enum(["greenhouse", "lever", "remotive"]),
  board: z.string().trim().min(1).max(120),
  label: z.string().trim().max(120).optional(),
});

export async function addJobSource(input: unknown) {
  const db = createDb();
  const data = sourceSchema.parse(input);
  const { error } = await db.from("job_sources").insert({
    kind: data.kind as JobSourceKind,
    board: data.board.toLowerCase(),
    label: data.label || data.board,
  });
  if (error) throw new Error(error.code === "23505" ? "That source is already added." : error.message);
  revalidatePath("/app/jobs");
}

export async function deleteJobSource(id: string) {
  const db = createDb();
  const { error } = await db.from("job_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/jobs");
}

export async function toggleJobSource(id: string, active: boolean) {
  const db = createDb();
  const { error } = await db.from("job_sources").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/jobs");
}

export async function runIngestNow(): Promise<IngestSummary> {
  const summary = await ingestAllSources();
  revalidatePath("/app/jobs");
  return summary;
}

export async function dismissOpportunity(id: string) {
  const db = createDb();
  const { error } = await db.from("opportunities")
    .update({ dismissed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/jobs");
}

export async function starOpportunity(id: string, starred: boolean) {
  const db = createDb();
  const { error } = await db.from("opportunities").update({ starred }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/jobs");
}

/** Move a feed job into the application pipeline (status: saved). */
export async function trackOpportunity(id: string) {
  const db = createDb();
  const { data: opp, error: oppErr } = await db.from("opportunities")
    .select("id,title,company,source").eq("id", id).single();
  if (oppErr) throw new Error(oppErr.message);

  const { data: existing } = await db.from("applications")
    .select("id").eq("opportunity_id", id).maybeSingle();
  if (existing) return existing.id;

  const resumeVersionId = await snapshotResumeVersion();
  const { data: app, error } = await db.from("applications").insert({
    opportunity_id: opp.id, job_title: opp.title, company: opp.company,
    status: "saved", source: opp.source, resume_version_id: resumeVersionId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/app/jobs");
  revalidatePath("/app/applications");
  return app.id;
}
