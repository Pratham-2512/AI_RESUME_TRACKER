"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { generateCoverLetter, type CoverLetterResult } from "@/lib/domain/coverLetter";
import {
  analyzeCompatibility, honestTailor, optimizeWithConfirmedSkills, generateLearningRoadmap,
  type CompatibilityAnalysis, type TailoringResult, type LearningRoadmap, type SkillConfirmation,
} from "@/lib/domain/tailorEngine";
import { snapshotResumeVersion } from "@/lib/resume/versioning";

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

// ─────────────────────────────────────────────────────────────────────────────
// Trust-first tailoring actions
// ─────────────────────────────────────────────────────────────────────────────

const compatSchema = z.object({
  resumeId: z.string().uuid(),
  jdText: z.string().trim().min(30).max(40000),
});

async function fetchResumeText(resumeId: string): Promise<string> {
  const db = createDb();
  const { data } = await db.from("resumes").select("parsed_text").eq("id", resumeId).single();
  if (!data?.parsed_text) throw new Error("Résumé not found — save it first.");
  return data.parsed_text;
}

export async function runCompatibilityAnalysis(input: unknown): Promise<CompatibilityAnalysis> {
  const { resumeId, jdText } = compatSchema.parse(input);
  const resumeText = await fetchResumeText(resumeId);
  return analyzeCompatibility(resumeText, jdText);
}

export type TailoringOutput = TailoringResult & { learningRoadmap: LearningRoadmap | null };

export async function runHonestTailor(input: unknown): Promise<TailoringOutput> {
  const { resumeId, jdText } = compatSchema.parse(input);
  const resumeText = await fetchResumeText(resumeId);
  const result = honestTailor(resumeText, jdText);
  const compat = analyzeCompatibility(resumeText, jdText);
  try {
    const db = createDb();
    const { data: last } = await db.from("resume_versions").select("version_no").eq("resume_id", resumeId).order("version_no", { ascending: false }).limit(1).maybeSingle();
    await db.from("resume_versions").insert({
      resume_id: resumeId, version_no: (last?.version_no ?? 0) + 1,
      target: "ats", content_md: result.contentMd, ats_score: result.afterScore, created_by_ai: false,
    });
  } catch { /* non-fatal */ }
  return { ...result, learningRoadmap: compat.matchScore < 70 ? generateLearningRoadmap(compat.missingSkills) : null };
}

const optimizeSchema = compatSchema.extend({
  confirmedSkills: z.array(z.object({
    skill: z.string(),
    confirmed: z.boolean(),
    level: z.enum(["beginner", "intermediate", "advanced"]),
  })),
});

export async function runOptimizedTailor(input: unknown): Promise<TailoringOutput> {
  const { resumeId, jdText, confirmedSkills } = optimizeSchema.parse(input);
  const resumeText = await fetchResumeText(resumeId);
  const result = optimizeWithConfirmedSkills(resumeText, jdText, confirmedSkills as SkillConfirmation[]);
  const compat = analyzeCompatibility(resumeText, jdText);
  try {
    const db = createDb();
    const { data: last } = await db.from("resume_versions").select("version_no").eq("resume_id", resumeId).order("version_no", { ascending: false }).limit(1).maybeSingle();
    await db.from("resume_versions").insert({
      resume_id: resumeId, version_no: (last?.version_no ?? 0) + 1,
      target: "ats", content_md: result.contentMd, ats_score: result.afterScore, created_by_ai: false,
    });
  } catch { /* non-fatal */ }
  return { ...result, learningRoadmap: compat.matchScore < 70 ? generateLearningRoadmap(compat.missingSkills) : null };
}

/** Apply Assistant: log the application into the pipeline (status=applied). */
export async function trackApplication(input: unknown): Promise<string> {
  const { jobTitle, company, opportunityId, notes } = trackSchema.parse(input);
  const db = createDb();
  const resumeVersionId = await snapshotResumeVersion();
  const { data, error } = await db.from("applications").insert({
    job_title: jobTitle,
    company: company || null,
    opportunity_id: opportunityId ?? null,
    status: "applied",
    applied_at: new Date().toISOString(),
    notes: notes || null,
    source: "application_studio",
    resume_version_id: resumeVersionId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/app/applications");
  return data.id;
}
