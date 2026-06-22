import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/lib/supabase/db";
import { ResumeInspector } from "@/components/resumes/resume-inspector";
import { DownloadOriginal } from "@/components/resumes/download-original";
import { JobMatchAnalyzer } from "@/components/resumes/job-match-analyzer";
import { ResumeVersions } from "@/components/resumes/resume-versions";
import { LinkedInPostPanel } from "@/components/linkedin/linkedin-post-panel";

export const dynamic = "force-dynamic";

export default async function ResumeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let resume: { id: string; label: string | null; target: string | null; parsed_text: string | null; storage_path: string | null } | null = null;
  let versions: { id: string; version_no: number; ats_score: number | null; content_md: string | null }[] = [];
  let atsScore: number | null = null;
  let dbError: string | null = null;

  try {
    const db = createDb();
    const r = await db.from("resumes").select("id,label,target,parsed_text,storage_path").eq("id", id).single();
    resume = r.data;
    if (resume) {
      const [a, v] = await Promise.all([
        db.from("resume_analyses")
          .select("before_score")
          .eq("resume_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("resume_versions")
          .select("id,version_no,ats_score,content_md")
          .eq("resume_id", id).order("version_no", { ascending: false }),
      ]);
      atsScore = a.data?.before_score ?? null;
      versions = v.data ?? [];
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  if (dbError) {
    return (
      <div className="animate-fade-up space-y-3">
        <Link href="/app/resumes" className="text-sm text-muted-foreground hover:text-foreground">← Résumés</Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Database error: {dbError}
        </div>
      </div>
    );
  }
  if (!resume) notFound();

  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Link href="/app/resumes" className="text-sm text-muted-foreground hover:text-foreground">← Résumés</Link>
        <div className="flex items-center gap-2">
          {resume.storage_path && <DownloadOriginal resumeId={id} />}
          <Link href={`/print/resume/${id}`} target="_blank" className="btn-outline btn-sm">Export PDF</Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{resume.label ?? "Résumé"}</h1>
        {atsScore != null && (
          <p className="mt-1 text-sm text-muted-foreground">
            ATS Score: <span className={`font-bold ${atsScore >= 80 ? "text-emerald-600 dark:text-emerald-400" : atsScore >= 60 ? "text-amber-600" : "text-destructive"}`}>{atsScore}</span>
          </p>
        )}
      </div>

      {/* Step 1 — ATS Analysis */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
          <h2 className="text-sm font-semibold">ATS Score Analysis</h2>
        </div>
        <ResumeInspector resumeId={id} />
      </section>

      {/* Steps 2–4 — JD Match + Optimize */}
      <section className="card p-5">
        <JobMatchAnalyzer resumeId={id} />
      </section>

      {/* Optimized versions */}
      {versions.length > 0 && (
        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">5</span>
            <h2 className="text-sm font-semibold">Optimized Versions</h2>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ResumeVersions versions={versions as any} />
        </section>
      )}

      {/* LinkedIn Post */}
      <section>
        <LinkedInPostPanel resumeId={id} />
      </section>

      {/* Raw extracted text (collapsed) */}
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">View extracted text</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{resume.parsed_text}</pre>
      </details>
    </div>
  );
}
