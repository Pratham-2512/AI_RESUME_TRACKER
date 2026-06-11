import Link from "next/link";
import { createDb } from "@/lib/supabase/db";
import { ResumeCreate } from "@/components/resumes/resume-create";
import { DeleteResumeButton } from "@/components/resumes/delete-resume-button";
import { PageHeader, ErrorBanner, Badge, Empty } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  let resumes: { id: string; label: string | null; target: string | null; status: string | null; is_primary: boolean | null }[] = [];
  let dbError: string | null = null;
  try {
    const db = createDb();
    const { data } = await db
      .from("resumes")
      .select("id,label,target,status,is_primary,created_at")
      .order("created_at", { ascending: false });
    resumes = data ?? [];
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="Résumés" desc="Get an ATS score and an AI-optimized rewrite." />

      {dbError && (
        <ErrorBanner>Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).</ErrorBanner>
      )}

      <ResumeCreate />

      <div className="space-y-3">
        {resumes.map((r) => (
          <div key={r.id} className="card card-hover group flex items-center gap-2 p-5">
            <Link href={`/app/resumes/${r.id}`} className="flex flex-1 items-center justify-between gap-4 min-w-0">
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {r.label ?? "Résumé"}
                  {r.is_primary && <Badge tone="primary" className="ml-2">primary</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">Target: {r.target} · {r.status}</p>
              </div>
              <span className="flex-shrink-0 text-sm font-medium text-primary transition-transform duration-150 group-hover:translate-x-0.5">Open →</span>
            </Link>
            <DeleteResumeButton id={r.id} label={r.label ?? "Résumé"} />
          </div>
        ))}
        {resumes.length === 0 && !dbError && (
          <Empty>No résumés yet. Add one to get your ATS score.</Empty>
        )}
      </div>
    </div>
  );
}
