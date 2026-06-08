import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/** Anthropic client — server only. Key from ANTHROPIC_API_KEY. */
export const anthropic = new Anthropic();

/** OpenAI client — embeddings only. Key from OPENAI_API_KEY. */
export const openai = new OpenAI();

/**
 * Opus 4.8 call conventions (docs/08):
 *  - thinking: {type:"adaptive"} (never budget_tokens)
 *  - output_config.effort for depth (never temperature/top_p)
 *  - stream when max_tokens is large
 */
export const ADAPTIVE_THINKING = { type: "adaptive" as const };
