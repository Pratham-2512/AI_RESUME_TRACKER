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
