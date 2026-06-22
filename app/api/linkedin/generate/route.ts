import { NextResponse } from "next/server";
import { createDb } from "@/lib/supabase/db";
import { anthropic, ADAPTIVE_THINKING } from "@/lib/ai/client";
import { FEATURE_CONFIG } from "@/lib/ai/models";
import { logAiUsage } from "@/lib/ai/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are an expert career coach and LinkedIn content strategist.
Your job: read a candidate's resume text and produce two things:
1. A compelling LinkedIn post (max 1,200 characters) that announces they are open to new opportunities.
2. A short, versatile cover letter template (3–4 paragraphs) they can customise per application.

Format your response as valid JSON with exactly two keys:
{
  "linkedin_post": "...",
  "cover_letter": "..."
}

LinkedIn post rules:
- Open with a powerful hook (question or bold statement).
- Mention their strongest skills and recent achievements with concrete numbers where available.
- State what type of role / industry they are seeking.
- End with a call to action + 3–5 relevant hashtags.
- Keep it human, warm, and professional — not robotic.
- Max 1,200 characters.

Cover letter rules:
- Paragraph 1: Introduction — who they are and the type of role they're targeting.
- Paragraph 2: Top 2–3 skills / achievements (with metrics from the resume).
- Paragraph 3: Why they are excited about this type of opportunity.
- Paragraph 4: Professional close with call to action.
- Use [Company Name], [Role], [Your Name] placeholders where needed.
- Keep it under 400 words.`;

function userPrompt(resumeText: string): string {
  return `Here is the candidate's resume text:\n\n---\n${resumeText.slice(0, 8000)}\n---\n\nGenerate the LinkedIn post and cover letter now.`;
}

export async function POST(req: Request) {
  const { resumeId } = (await req.json()) as { resumeId: string };
  if (!resumeId) {
    return NextResponse.json({ error: "resumeId required" }, { status: 400 });
  }

  const db = createDb();
  const { data: resume } = await db
    .from("resumes")
    .select("parsed_text,label")
    .eq("id", resumeId)
    .single();

  if (!resume?.parsed_text) {
    return NextResponse.json({ error: "Resume text not found. Upload and parse your resume first." }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const cfg = FEATURE_CONFIG.linkedin;
  const t0 = Date.now();

  const res = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: 4000,
    ...(cfg.model.startsWith("claude-opus") ? { thinking: ADAPTIVE_THINKING } : {}),
    ...(cfg.model.startsWith("claude-opus") && cfg.effort
      ? { output_config: { effort: cfg.effort } }
      : {}),
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt(resume.parsed_text) }],
  } as Parameters<typeof anthropic.messages.create>[0]) as Awaited<
    ReturnType<typeof anthropic.messages.create>
  > & { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } };

  const rawText = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  await logAiUsage({
    feature: "linkedin",
    model: cfg.model,
    tokensIn: res.usage.input_tokens,
    tokensOut: res.usage.output_tokens,
    latencyMs: Date.now() - t0,
  });

  // Parse JSON from response (strip markdown fences if present)
  let parsed: { linkedin_post: string; cover_letter: string };
  try {
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonStr = fenced ? fenced[1] : rawText.slice(rawText.search(/[{[]/));
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    return NextResponse.json({ error: "AI returned unexpected format. Try again." }, { status: 500 });
  }

  // Save the generated post to generated_documents
  try {
    await db.from("generated_documents").insert({
      resume_id: resumeId,
      type: "linkedin_post",
      title: `LinkedIn Post – ${resume.label ?? "Resume"}`,
      content: parsed.linkedin_post,
      model: cfg.model,
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ data: parsed });
}
