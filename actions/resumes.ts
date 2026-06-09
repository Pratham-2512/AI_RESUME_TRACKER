"use server";

import { revalidatePath } from "next/cache";
import { createDb } from "@/lib/supabase/db";
import { resumeTargetSchema } from "@/lib/domain/validation";
import { z } from "zod";

const createSchema = z.object({
  label: z.string().trim().max(120).optional(),
  text: z.string().trim().min(50, "Paste at least a few lines of your resume").max(40000),
  target: resumeTargetSchema.default("generic"),
});

export async function createResumeFromText(input: unknown) {
  const db = createDb();
  const { label, text, target } = createSchema.parse(input);
  const { data, error } = await db
    .from("resumes")
    .insert({ label: label || "Pasted resume", target, parsed_text: text, source: "paste", status: "parsed" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/app/resumes");
  return data.id;
}

const uploadSchema = createSchema.extend({
  storagePath: z.string().trim().max(400).nullish(),
  fileName: z.string().trim().max(200).nullish(),
});

/** Persist a résumé created from an uploaded file (text already extracted + editable). */
export async function createResumeFromUpload(input: unknown) {
  const db = createDb();
  const { label, text, target, storagePath, fileName } = uploadSchema.parse(input);
  const { data, error } = await db
    .from("resumes")
    .insert({
      label: label || fileName || "Uploaded resume",
      target,
      parsed_text: text,
      source: "upload",
      status: "parsed",
      storage_path: storagePath ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/app/resumes");
  return data.id;
}

/** Signed, time-limited download URL for a résumé's original uploaded file. */
export async function getResumeDownloadUrl(id: string): Promise<string | null> {
  const db = createDb();
  const { data: resume, error } = await db.from("resumes").select("storage_path").eq("id", id).single();
  if (error) throw new Error(error.message);
  if (!resume?.storage_path) return null;
  const { data, error: signErr } = await db.storage
    .from("resumes")
    .createSignedUrl(resume.storage_path, 120, { download: true });
  if (signErr) throw new Error(signErr.message);
  return data.signedUrl;
}

export async function deleteResume(id: string) {
  const db = createDb();
  const { error } = await db.from("resumes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/resumes");
}

export async function setPrimaryResume(id: string) {
  const db = createDb();
  await db.from("resumes").update({ is_primary: false }).neq("id", id);
  await db.from("resumes").update({ is_primary: true }).eq("id", id);
  revalidatePath("/app/resumes");
}
