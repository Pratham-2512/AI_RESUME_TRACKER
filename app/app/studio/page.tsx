import { createDb } from "@/lib/supabase/db";
import { ApplicationStudio } from "@/components/studio/application-studio";

export const dynamic = "force-dynamic";

export default async function ApplicationStudioPage() {
  let resumes: { id: string; label: string | null }[] = [];
  let opportunities: { id: string; title: string; company: string | null; job_text: string | null; url: string | null }[] = [];
  try {
    const db = createDb();
    const [r, o] = await Promise.all([
      db.from("resumes").select("id,label").order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
      db.from("opportunities").select("id,title,company,job_text,url").order("created_at", { ascending: false }).limit(50),
    ]);
    resumes = r.data ?? [];
    opportunities = o.data ?? [];
  } catch { /* graceful — studio still works with paste-in JD */ }

  return (
    <div>
      <h1 className="text-2xl font-bold">Application Studio</h1>
      <p className="mt-1 text-muted-foreground">
        One pipeline: pick a job → analyze the JD → tailor your résumé → generate a cover letter → apply &amp; track.
      </p>
      <div className="mt-6">
        <ApplicationStudio resumes={resumes} opportunities={opportunities} />
      </div>
    </div>
  );
}
