#!/usr/bin/env node
/**
 * Trigger the job-ingest endpoint manually:
 *   npm run ingest              → uses NEXT_PUBLIC_APP_URL from .env.local
 *   npm run ingest -- http://localhost:3000
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const base = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET || process.env.WORKER_SECRET;
if (!secret) { console.error("Missing WORKER_SECRET (or CRON_SECRET) in .env.local"); process.exit(1); }

const res = await fetch(`${base.replace(/\/$/, "")}/api/jobs/ingest`, {
  method: "POST", headers: { "x-worker-secret": secret },
});
const body = await res.json().catch(() => null);
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
