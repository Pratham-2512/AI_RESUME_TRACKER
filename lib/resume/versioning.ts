import "server-only";
import { createDb } from "@/lib/supabase/db";

/**
 * Snapshot the résumé that an application is being sent with, so the exact
 * content is preserved even if the résumé is edited later.
 *
 * Uses the primary résumé (falling back to the most recent one). If its text
 * already matches the latest stored version, that version is reused instead
 * of writing a duplicate.
 */
export async function snapshotResumeVersion(resumeId?: string): Promise<string | null> {
  const db = createDb();

  let resume: { id: string; target: string | null; parsed_text: string | null } | null = null;
  if (resumeId) {
    const { data } = await db.from("resumes").select("id,target,parsed_text").eq("id", resumeId).maybeSingle();
    resume = data;
  }
  if (!resume) {
    const { data } = await db.from("resumes").select("id,target,parsed_text").eq("is_primary", true).maybeSingle();
    resume = data;
  }
  if (!resume) {
    const { data } = await db.from("resumes").select("id,target,parsed_text")
      .not("parsed_text", "is", null).order("updated_at", { ascending: false }).limit(1);
    resume = data?.[0] ?? null;
  }
  if (!resume?.parsed_text) return null;

  const { data: last } = await db.from("resume_versions")
    .select("id,version_no,content_md").eq("resume_id", resume.id)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();

  if (last?.content_md === resume.parsed_text) return last.id;

  const { data: created, error } = await db.from("resume_versions").insert({
    resume_id: resume.id,
    version_no: (last?.version_no ?? 0) + 1,
    target: (resume.target ?? "generic") as never,
    content_md: resume.parsed_text,
    created_by_ai: false,
  }).select("id").single();
  if (error) {
    console.error("[resume snapshot]", error.message);
    return null;
  }
  return created.id;
}
