import { createDb } from "@/lib/supabase/db";
import { TailorStudio } from "@/components/tailor/tailor-studio";
import { PageHeader } from "@/components/shared/ui";

export const dynamic = "force-dynamic";

export default async function TailorPage() {
  let resumes: { id: string; label: string | null }[] = [];
  try {
    const db = createDb();
    const { data } = await db.from("resumes").select("id,label").order("created_at", { ascending: false });
    resumes = data ?? [];
  } catch { /* DB optional — paste path still works */ }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Résumé Tailoring Studio"
        desc="Pick a résumé, paste a job description — get an ATS match, gap analysis, and a tailored résumé."
      />
      <TailorStudio resumes={resumes} />
    </div>
  );
}
