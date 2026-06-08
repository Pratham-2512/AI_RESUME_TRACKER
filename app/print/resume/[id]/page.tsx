import { notFound } from "next/navigation";
import { createDb } from "@/lib/supabase/db";
import { PrintButton } from "@/components/resumes/print-button";

export const dynamic = "force-dynamic";

// Standalone print view (root layout only — no app sidebar). "Save as PDF" from the browser.
export default async function ResumePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createDb();

  const { data: resume } = await db.from("resumes").select("label,parsed_text").eq("id", id).single();
  if (!resume) notFound();

  const { data: version } = await db
    .from("resume_versions").select("content_md").eq("resume_id", id)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();

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
