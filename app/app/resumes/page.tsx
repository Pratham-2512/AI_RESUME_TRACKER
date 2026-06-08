import Link from "next/link";
import { createDb } from "@/lib/supabase/db";
import { ResumeCreate } from "@/components/resumes/resume-create";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const db = createDb();
  let resumes: { id: string; label: string | null; target: string | null; status: string | null; is_primary: boolean | null }[] = [];
  let dbError: string | null = null;
  try {
    const { data } = await db
      .from("resumes")
      .select("id,label,target,status,is_primary,created_at")
      .order("created_at", { ascending: false });
    resumes = data ?? [];
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Résumés</h1>
      <p className="mt-1 text-muted-foreground">Get an ATS score and an AI-optimized rewrite.</p>

      {dbError && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).
        </div>
      )}

      <div className="mt-6"><ResumeCreate /></div>

      <div className="mt-6 space-y-3">
        {resumes.map((r) => (
          <Link key={r.id} href={`/app/resumes/${r.id}`} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted">
            <div>
              <p className="font-medium">{r.label ?? "Résumé"} {r.is_primary && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">primary</span>}</p>
              <p className="text-sm text-muted-foreground">Target: {r.target} · {r.status}</p>
            </div>
            <span className="text-sm text-primary">Open →</span>
          </Link>
        ))}
        {resumes.length === 0 && !dbError && (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No résumés yet. Add one to get your ATS score.
          </p>
        )}
      </div>
    </div>
  );
}
