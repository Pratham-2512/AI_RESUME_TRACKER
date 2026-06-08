import { NextResponse } from "next/server";
import { z } from "zod";
import { generateQuestions } from "@/lib/domain/interviewEngine";
import { extractRequirements } from "@/lib/domain/matchEngine";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  opportunityId: z.string().uuid().optional(),
  resumeId: z.string().uuid().optional(),
  jdText: z.string().trim().max(40000).optional(),
  resumeText: z.string().trim().max(40000).optional(),
  title: z.string().trim().max(200).optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Invalid request body" } }, { status: 400 }); }

  let jdSkills: string[] = [];
  let jdText = body.jdText ?? "";
  let title = body.title ?? "Interview kit";
  let candidateSkills: string[] = [];
  let projects: string[] = [];

  const db = (() => { try { return createDb(); } catch { return null; } })();

  // 1. Resolve job context — opportunity row > pasted JD text.
  if (body.opportunityId && db) {
    try {
      const { data } = await db.from("opportunities").select("title,company,required_skills,job_text").eq("id", body.opportunityId).single();
      if (data) {
        jdSkills = data.required_skills ?? [];
        jdText = data.job_text ?? jdText;
        title = body.title ?? `${data.title}${data.company ? ` · ${data.company}` : ""}`;
      }
    } catch { /* fall back to jdText */ }
  }
  if (jdSkills.length === 0 && jdText) jdSkills = extractRequirements(jdText).skills;

  // 2. Resolve candidate context — résumé text/row > profile skills + projects.
  let resumeText = body.resumeText ?? "";
  if (!resumeText && body.resumeId && db) {
    try {
      const { data } = await db.from("resumes").select("parsed_text").eq("id", body.resumeId).single();
      resumeText = data?.parsed_text ?? "";
    } catch { /* ignore */ }
  }
  if (resumeText) candidateSkills = extractRequirements(resumeText).skills;
  if (db) {
    try {
      const [{ data: skills }, { data: projs }] = await Promise.all([
        db.from("skills").select("name"),
        db.from("projects").select("name").order("sort_order", { ascending: true }).limit(4),
      ]);
      if (candidateSkills.length === 0) candidateSkills = (skills ?? []).map((s) => s.name);
      projects = (projs ?? []).map((p) => p.name);
    } catch { /* ignore */ }
  }

  if (jdSkills.length === 0 && candidateSkills.length === 0) {
    return NextResponse.json({ data: null, error: { code: "NO_CONTEXT", message: "Provide a job description (or opportunity) and/or a résumé so questions can be generated." } }, { status: 400 });
  }

  // 3. Generate (deterministic, no LLM).
  const questions = generateQuestions({ jdSkills, candidateSkills, projects });

  // 4. Best-effort persist.
  let kitId: string | null = null;
  if (body.persist !== false && db) {
    try {
      const { data: kit } = await db.from("interview_kits").insert({
        opportunity_id: body.opportunityId ?? null, title, model: "deterministic-v1",
      }).select("id").single();
      kitId = kit?.id ?? null;
      if (kitId) {
        const rows = questions.map((q, i) => ({
          kit_id: kitId as string, kind: q.kind, difficulty: q.difficulty,
          question: q.question, suggested_answer: q.suggested_answer,
          confidence: q.confidence, sort_order: i,
        }));
        await db.from("interview_questions").insert(rows);
      }
    } catch (e) { console.error("[interview kit persist]", e); }
  }

  return NextResponse.json({ data: { kitId, title, questions, jdSkills, candidateSkills }, error: null });
}
