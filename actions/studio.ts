"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { generateCoverLetter, type CoverLetterResult } from "@/lib/domain/coverLetter";

const coverSchema = z.object({
  resumeId: z.string().uuid(),
  jobTitle: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional(),
  jdText: z.string().trim().min(30).max(40000),
  opportunityId: z.string().uuid().nullish(),
});

/** Generate a deterministic cover letter from real data and persist it. */
export async function createCoverLetter(input: unknown): Promise<CoverLetterResult & { id: string | null }> {
  const { resumeId, jobTitle, company, jdText, opportunityId } = coverSchema.parse(input);
  const db = createDb();

  const [{ data: resume }, { data: profile }] = await Promise.all([
    db.from("resumes").select("parsed_text").eq("id", resumeId).single(),
    db.from("profiles").select("full_name,headline,years_experience").eq("id", OWNER_ID).maybeSingle(),
  ]);
  if (!resume?.parsed_text) throw new Error("Résumé text not found");

  const letter = generateCoverLetter({
    fullName: profile?.full_name,
    headline: profile?.headline,
    yearsExperience: profile?.years_experience,
    resumeText: resume.parsed_text,
    jobTitle,
    company,
    jdText,
  });

  let id: string | null = null;
  try {
    const { data } = await db.from("generated_documents").insert({
      type: "cover_letter",
      title: letter.title,
      content: letter.content,
      resume_id: resumeId,
      opportunity_id: opportunityId ?? null,
      model: "deterministic-v1",
    }).select("id").single();
    id = data?.id ?? null;
  } catch (e) {
    console.error("[cover letter persist]", e); // non-fatal — letter still returned
  }
  return { ...letter, id };
}

const trackSchema = z.object({
  jobTitle: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional(),
  opportunityId: z.string().uuid().nullish(),
  notes: z.string().trim().max(2000).optional(),
});

/** Apply Assistant: log the application into the pipeline (status=applied). */
export async function trackApplication(input: unknown): Promise<string> {
  const { jobTitle, company, opportunityId, notes } = trackSchema.parse(input);
  const db = createDb();
  const { data, error } = await db.from("applications").insert({
    job_title: jobTitle,
    company: company || null,
    opportunity_id: opportunityId ?? null,
    status: "applied",
    applied_at: new Date().toISOString(),
    notes: notes || null,
    source: "application_studio",
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/app/applications");
  return data.id;
}
