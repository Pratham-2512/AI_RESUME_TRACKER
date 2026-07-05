import "server-only";
import type { JobSourceKind, JobType, WorkMode } from "@/lib/supabase/database.types";

/**
 * Job-source adapters. Each fetches a public, ToS-friendly job API and
 * normalizes postings to a common shape. No scraping of authenticated or
 * bot-protected boards (LinkedIn/Naukri/Indeed are deliberately absent).
 *
 *   greenhouse — board token, e.g. "anthropic"  → boards-api.greenhouse.io
 *   lever      — company slug, e.g. "netflix"   → api.lever.co
 *   remotive   — search query, e.g. "ai engineer" → remotive.com/api
 */
export type NormalizedJob = {
  externalId: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string | null;
  applyUrl: string | null;
  jobText: string;
  postedAt: string | null;
  salaryText: string | null;
  workMode: WorkMode | null;
  jobType: JobType | null;
};

const MAX_JOBS_PER_SOURCE = 100;
const FETCH_HEADERS = { "user-agent": "Mozilla/5.0 AICareerOS-ingest" };

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

export function stripHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/li|\/div|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function detectWorkMode(text: string): WorkMode | null {
  const t = text.toLowerCase();
  if (/\bremote\b/.test(t)) return /\bhybrid\b/.test(t) ? "hybrid" : "remote";
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bon-?site\b/.test(t)) return "onsite";
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// ---- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true ----
type GreenhouseJob = {
  id: number; title: string; absolute_url: string; updated_at?: string; first_published?: string;
  location?: { name?: string }; content?: string; company_name?: string;
};
async function fetchGreenhouse(board: string): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`
  )) as { jobs?: GreenhouseJob[] };
  return (data.jobs ?? []).slice(0, MAX_JOBS_PER_SOURCE).map((j) => {
    const text = stripHtml(j.content ?? "");
    return {
      externalId: String(j.id),
      title: j.title,
      company: j.company_name ?? board,
      location: j.location?.name ?? null,
      url: j.absolute_url,
      applyUrl: j.absolute_url,
      jobText: text.slice(0, 20000),
      postedAt: j.first_published ?? j.updated_at ?? null,
      salaryText: null,
      workMode: detectWorkMode(`${j.location?.name ?? ""} ${text.slice(0, 2000)}`),
      jobType: null,
    };
  });
}

// ---- Lever: https://api.lever.co/v0/postings/{slug}?mode=json ----
type LeverPosting = {
  id: string; text: string; hostedUrl?: string; applyUrl?: string; createdAt?: number;
  categories?: { location?: string; commitment?: string };
  workplaceType?: string; descriptionPlain?: string; salaryDescriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
};
function leverJobType(commitment?: string): JobType | null {
  const c = (commitment ?? "").toLowerCase();
  if (c.includes("intern")) return "internship";
  if (c.includes("contract")) return "contract";
  if (c.includes("part")) return "part_time";
  if (c.includes("full")) return "full_time";
  return null;
}
async function fetchLever(slug: string): Promise<NormalizedJob[]> {
  const postings = (await fetchJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`
  )) as LeverPosting[];
  return (postings ?? []).slice(0, MAX_JOBS_PER_SOURCE).map((p) => {
    const lists = (p.lists ?? []).map((l) => `${l.text ?? ""}\n${stripHtml(l.content ?? "")}`).join("\n");
    const text = `${p.descriptionPlain ?? ""}\n${lists}`.trim();
    const wp = (p.workplaceType ?? "").toLowerCase();
    return {
      externalId: p.id,
      title: p.text,
      company: slug,
      location: p.categories?.location ?? null,
      url: p.hostedUrl ?? null,
      applyUrl: p.applyUrl ?? p.hostedUrl ?? null,
      jobText: text.slice(0, 20000),
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      salaryText: p.salaryDescriptionPlain ?? null,
      workMode: wp === "remote" ? "remote" : wp === "hybrid" ? "hybrid" : wp.startsWith("on") ? "onsite" : null,
      jobType: leverJobType(p.categories?.commitment),
    };
  });
}

// ---- Remotive: https://remotive.com/api/remote-jobs?search={query} ----
type RemotiveJob = {
  id: number; url: string; title: string; company_name?: string; job_type?: string;
  publication_date?: string; candidate_required_location?: string; salary?: string; description?: string;
};
function remotiveJobType(t?: string): JobType | null {
  if (t === "full_time" || t === "contract" || t === "part_time" || t === "internship") return t;
  return null;
}
async function fetchRemotive(query: string): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${MAX_JOBS_PER_SOURCE}`
  )) as { jobs?: RemotiveJob[] };
  return (data.jobs ?? []).slice(0, MAX_JOBS_PER_SOURCE).map((j) => ({
    externalId: String(j.id),
    title: j.title,
    company: j.company_name ?? null,
    location: j.candidate_required_location ?? "Remote",
    url: j.url,
    applyUrl: j.url,
    jobText: stripHtml(j.description ?? "").slice(0, 20000),
    postedAt: j.publication_date ?? null,
    salaryText: j.salary || null,
    workMode: "remote",
    jobType: remotiveJobType(j.job_type),
  }));
}

export async function fetchSource(kind: JobSourceKind, board: string): Promise<NormalizedJob[]> {
  switch (kind) {
    case "greenhouse": return fetchGreenhouse(board);
    case "lever": return fetchLever(board);
    case "remotive": return fetchRemotive(board);
  }
}

/** Canonical `opportunities.source` value for an ingested job. */
export function sourceKey(kind: JobSourceKind, board: string): string {
  return `${kind}:${board.toLowerCase()}`;
}
