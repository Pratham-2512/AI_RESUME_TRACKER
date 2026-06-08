import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeResumeText } from "@/lib/domain/resumeEngine";
import { resumeTargetSchema } from "@/lib/domain/validation";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 20;

const bodySchema = z.object({
  text: z.string().trim().max(40000).optional(),
  resumeId: z.string().uuid().optional(),
  target: resumeTargetSchema.optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Provide text or resumeId" } }, { status: 400 }); }

  let text = body.text ?? "";
  let target = body.target ?? "generic";

  // DB path: load résumé text by id (graceful if schema absent)
  if (!text && body.resumeId) {
    try {
      const db = createDb();
      const { data } = await db.from("resumes").select("parsed_text,target").eq("id", body.resumeId).single();
      text = data?.parsed_text ?? "";
      target = (data?.target ?? "generic") as typeof target;
    } catch { /* no DB */ }
  }
  if (text.trim().length < 30) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Résumé text too short" } }, { status: 400 });
  }

  const analysis = analyzeResumeText(text, target);

  // Best-effort: store the deterministic ATS score as an analysis row
  if (body.persist && body.resumeId) {
    try {
      const db = createDb();
      await db.from("resume_analyses").insert({
        resume_id: body.resumeId,
        before_score: analysis.atsScore,
        ats_breakdown: analysis.atsBreakdown,
        missing_keywords: analysis.missingKeywords,
        weak_sections: analysis.weakBullets.map((b) => ({ section: "bullet", issue: b.issues.join("; "), suggestion: b.suggestion ?? "" })),
        model: "deterministic-v1",
      });
    } catch (e) { console.error("[inspect persist]", e); }
  }

  return NextResponse.json({ data: analysis, error: null });
}
