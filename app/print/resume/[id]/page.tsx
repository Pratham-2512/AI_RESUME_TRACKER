import { notFound } from "next/navigation";
import { createDb } from "@/lib/supabase/db";
import { PrintButton } from "@/components/resumes/print-button";

export const dynamic = "force-dynamic";

// Standalone print view (root layout only — no app sidebar). "Save as PDF" from the browser.
export default async function ResumePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch inside try/catch (graceful DB failure). notFound() stays outside.
  let resume: { label: string | null; parsed_text: string | null } | null = null;
  let version: { content_md: string | null } | null = null;
  let dbError: string | null = null;
  try {
    const db = createDb();
    const r = await db.from("resumes").select("label,parsed_text").eq("id", id).single();
    resume = r.data;
    if (resume) {
      const v = await db
        .from("resume_versions").select("content_md").eq("resume_id", id)
        .order("version_no", { ascending: false }).limit(1).maybeSingle();
      version = v.data;
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database not reachable";
  }

  if (dbError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">
        Database not ready: {dbError}. Apply the schema (see SUPABASE_SETUP.md).
      </div>
    );
  }
  if (!resume) notFound();

  const content = version?.content_md ?? resume.parsed_text ?? "";

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <span className="text-sm text-muted-foreground">{resume.label ?? "Résumé"} · use Save as PDF</span>
          <PrintButton />
        </div>
        <article className="resume-print whitespace-pre-wrap rounded-lg bg-white p-12 text-[13px] leading-relaxed text-gray-900 shadow">
          {content}
        </article>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .resume-print { box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
          @page { margin: 18mm; }
        }
      `}</style>
    </div>
  );
}
