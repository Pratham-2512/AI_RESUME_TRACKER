import { NextResponse } from "next/server";
import { ingestAllSources } from "@/lib/jobs/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Poll all active job sources. Called by Vercel Cron (GET with
 * `Authorization: Bearer $CRON_SECRET`) or manually with the worker secret.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.WORKER_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}` || req.headers.get("x-worker-secret") === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "Bad or missing secret" } }, { status: 401 });
  }
  try {
    const summary = await ingestAllSources();
    return NextResponse.json({ data: summary, error: null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ data: null, error: { code: "INGEST_FAILED", message } }, { status: 500 });
  }
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
