import "server-only";
import type { z } from "zod";
import { anthropic, ADAPTIVE_THINKING } from "./client";

/** Strip ```json fences and parse the first JSON object/array in a string. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in model output");
  return JSON.parse(body.slice(start).trim());
}

/**
 * Call an Opus/Haiku model for a JSON result and validate with a Zod schema.
 * Opus 4.8 rules honored: adaptive thinking, effort via output_config, no temperature/prefill.
 */
export async function runJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<{ data: T; tokensIn: number; tokensOut: number }> {
  const isOpus = opts.model.startsWith("claude-opus");
  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8000,
    ...(isOpus ? { thinking: ADAPTIVE_THINKING } : {}),
    ...(isOpus && opts.effort ? { output_config: { effort: opts.effort } } : {}),
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.user }],
  } as Parameters<typeof anthropic.messages.create>[0]) as Awaited<ReturnType<typeof anthropic.messages.create>> & {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const data = opts.schema.parse(extractJson(text));
  return { data, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens };
}
