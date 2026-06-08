import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAnswer } from "@/lib/domain/interviewEngine";
import { createDb } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  answer: z.string().trim().min(1).max(20000),
  kind: z.enum(["technical", "behavioral", "hr", "project"]),
  question: z.string().trim().max(2000).optional(),
  expectedConcepts: z.array(z.string().trim().max(120)).max(20).optional(),
  kitId: z.string().uuid().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ data: null, error: { code: "VALIDATION", message: "Provide an answer and a question kind." } }, { status: 400 }); }

  const evaluation = evaluateAnswer({
    answer: body.answer,
    kind: body.kind,
    expectedConcepts: body.expectedConcepts ?? [],
  });

  // Log the practice session so it powers the readiness dashboard (existing analytics_events table).
  if (body.persist !== false) {
    try {
      const db = createDb();
      const s = evaluation.scores;
      await db.from("analytics_events").insert({
        type: "interview_practice",
        feature: body.kind,
        model: "deterministic-v1",
        props: {
          kind: body.kind,
          question: body.question ?? null,
          kitId: body.kitId ?? null,
          communication: s.communication,
          technical: s.technical,
          confidence: s.confidence,
          structure: s.structure,
          completeness: s.completeness,
          overall: s.overall,
          star: evaluation.star ?? null,
          wordCount: evaluation.wordCount,
        },
      });
    } catch (e) { console.error("[interview evaluate persist]", e); }
  }

  return NextResponse.json({ data: evaluation, error: null });
}
