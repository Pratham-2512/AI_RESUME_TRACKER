import { createDb } from "@/lib/supabase/db";
import { TailorStudio } from "@/components/tailor/tailor-studio";

export const dynamic = "force-dynamic";

export default async function TailorPage() {
  let resumes: { id: string; label: string | null }[] = [];
  try {
    const db = createDb();
    const { data } = await db.from("resumes").select("id,label").order("created_at", { ascending: false });
    resumes = data ?? [];
  } catch { /* DB optional — paste path still works */ }

  return (
    <div>
      <h1 className="text-2xl font-bold">Résumé Tailoring Studio</h1>
      <p className="mt-1 text-muted-foreground">
        Pick a résumé, paste a job description — get an ATS match, gap analysis, and a tailored résumé.
      </p>
      <div className="mt-6">
        <TailorStudio resumes={resumes} />
      </div>
    </div>
  );
}
