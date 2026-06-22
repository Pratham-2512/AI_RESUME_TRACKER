import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/lib/supabase/db";
import { ResumeWorkspace } from "@/components/resumes/resume-workspace";
import { ResumeInspector } from "@/components/resumes/resume-inspector";
import { DownloadOriginal } from "@/components/resumes/download-original";
import { LinkedInPostPanel } from "@/components/linkedin/linkedin-post-panel";

export const dynamic = "force-dynamic";

export default async function ResumeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch inside try/catch so a missing-env / unreachable-DB error degrades
  // gracefully instead of producing an HTTP 500. notFound() is kept OUTSIDE the
  // try because it works by throwing and must be allowed to propagate.
  let resume: { id: string; label: string | null; target: string | null; parsed_text: string | null; storage_path: string | null } | null = null;
  let analysis: unknown = null;
  let versions: unknown[] = [];
  let dbError: string | null = null;
  try {
    const db = createDb();
    const r = await db.from("resumes").select("id,label,target,parsed_text,storage_path").eq("id", id).single();
    resume = r.data;
    if (resume) {
      const [a, v] = await Promise.all([
        db.from("resume_analyses")
          .select("before_score,ats_breakdown,missing_keywords,missing_skills,weak_sections,suggestions")
          .eq("resume_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("resume_versions")
          .select("id,version_no,ats_score,content_md")
          .eq("resume_id", id).order("version_no", { ascending: false }),
      ]);
      analysis = a.data;
      versions = v.data ?? [];
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  if (dbError) {
    return (
      <div className="animate-fade-up">
        <Link href="/app/resumes" className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Résumés</Link>
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).
        </div>
      </div>
    );
  }
  if (!resume) notFound();

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between gap-2">
        <Link href="/app/resumes" className="text-sm text-muted-foreground transition-colors hover:text-foreground">← Résumés</Link>
        <div className="flex items-center gap-2">
          {resume.storage_path && <DownloadOriginal resumeId={id} />}
          <Link href={`/print/resume/${id}`} target="_blank" className="btn-outline btn-sm">
            Export PDF
          </Link>
        </div>
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{resume.label ?? "Résumé"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Target: {resume.target}</p>

      <div className="mt-6 space-y-6">
        {/* Re-run ATS Analysis */}
        <ResumeInspector resumeId={id} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ResumeWorkspace resumeId={id} initialAnalysis={(analysis as any) ?? null} initialVersions={(versions as any) ?? []} />
      </div>

      {/* LinkedIn Post Automation */}
      <div className="mt-8">
        <LinkedInPostPanel resumeId={id} />
      </div>

      {/* View Extracted Text */}
      <details className="mt-6 card p-4">
        <summary className="cursor-pointer text-sm font-medium">View extracted text</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">{resume.parsed_text}</pre>
      </details>
    </div>
  );
}
