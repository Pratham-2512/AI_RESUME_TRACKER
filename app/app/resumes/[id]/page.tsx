import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/lib/supabase/db";
import { ResumeWorkspace } from "@/components/resumes/resume-workspace";
import { ResumeInspector } from "@/components/resumes/resume-inspector";

export const dynamic = "force-dynamic";

export default async function ResumeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createDb();

  const { data: resume } = await db.from("resumes").select("id,label,target,parsed_text").eq("id", id).single();
  if (!resume) notFound();

  const [{ data: analysis }, { data: versions }] = await Promise.all([
    db.from("resume_analyses")
      .select("before_score,ats_breakdown,missing_keywords,missing_skills,weak_sections,suggestions")
      .eq("resume_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("resume_versions")
      .select("id,version_no,ats_score,content_md")
      .eq("resume_id", id).order("version_no", { ascending: false }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/app/resumes" className="text-sm text-muted-foreground hover:underline">← Résumés</Link>
        <Link href={`/print/resume/${id}`} target="_blank" className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          Export PDF
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold">{resume.label ?? "Résumé"}</h1>
      <p className="mt-1 text-muted-foreground">Target: {resume.target}</p>

      <div className="mt-6 space-y-6">
        <ResumeInspector resumeId={id} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ResumeWorkspace resumeId={id} initialAnalysis={(analysis as any) ?? null} initialVersions={(versions as any) ?? []} />
      </div>

      <details className="mt-8 rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">View parsed text</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">{resume.parsed_text}</pre>
      </details>
    </div>
  );
}
