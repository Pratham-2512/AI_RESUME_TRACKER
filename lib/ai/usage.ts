import "server-only";
import { createDb } from "@/lib/supabase/db";
import { costUsd, type AiFeature } from "./models";

/** Append a row to ai_usage_log. Never throws into the caller. */
export async function logAiUsage(params: {
  feature: AiFeature;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheRead?: number;
  latencyMs?: number;
}) {
  try {
    const { feature, model, tokensIn = 0, tokensOut = 0, latencyMs } = params;
    const db = createDb();
    await db.from("analytics_events").insert({
      type: "ai_usage", feature, model, tokens_in: tokensIn, tokens_out: tokensOut,
      cost_usd: costUsd(model, tokensIn, tokensOut), latency_ms: latencyMs ?? null,
    });
  } catch (e) {
    console.error("[ai_usage_log] failed:", e);
  }
}
