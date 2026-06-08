import "server-only";
import { openai } from "./client";
import { MODELS } from "./models";

/** Embed a single string → 1536-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: MODELS.embedding,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

/** Batch embed (OpenAI allows up to ~2048 inputs/call). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai.embeddings.create({
    model: MODELS.embedding,
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return res.data.map((d) => d.embedding);
}
