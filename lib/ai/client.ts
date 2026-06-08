import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Lazy client proxy. The underlying SDK is only constructed on first property
 * access (i.e. at request time), not at module load. This prevents the
 * constructor from throwing during `next build` page-data collection, where
 * ANTHROPIC_API_KEY / OPENAI_API_KEY are not present.
 */
function lazyClient<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const get = () => (instance ??= factory());
  return new Proxy({} as T, {
    get: (_t, prop) => Reflect.get(get() as object, prop, get()),
    has: (_t, prop) => Reflect.has(get() as object, prop),
  });
}

/** Anthropic client — server only. Key from ANTHROPIC_API_KEY. */
export const anthropic = lazyClient(() => new Anthropic());

/** OpenAI client — embeddings only. Key from OPENAI_API_KEY. */
export const openai = lazyClient(() => new OpenAI());

/**
 * Opus 4.8 call conventions (docs/08):
 *  - thinking: {type:"adaptive"} (never budget_tokens)
 *  - output_config.effort for depth (never temperature/top_p)
 *  - stream when max_tokens is large
 */
export const ADAPTIVE_THINKING = { type: "adaptive" as const };
