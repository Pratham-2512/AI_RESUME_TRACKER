import "server-only";
import { createDb } from "@/lib/supabase/db";
import { OWNER_ID } from "@/lib/owner";
import { scoreMatch } from "@/lib/domain/matchEngine";
import { embedBatch } from "@/lib/ai/embeddings";
import { fetchSource, sourceKey, type NormalizedJob } from "./sources";

export type SourceResult = {
  sourceId: string; label: string; fetched: number; added: number; error: string | null;
};
export type IngestSummary = { ran: number; totalAdded: number; results: SourceResult[] };

const MAX_NEW_PER_SOURCE = 50;

/** Poll every active job source, dedup, score against the profile, and insert. */
export async function ingestAllSources(): Promise<IngestSummary> {
  const db = createDb();

  const { data: sources, error: srcErr } = await db
    .from("job_sources").select("*").eq("active", true).order("created_at");
  if (srcErr) throw new Error(srcErr.message);
  if (!sources?.length) return { ran: 0, totalAdded: 0, results: [] };

  // Candidate context, fetched once — the deterministic engine scores every new job.
  const [{ data: skills }, { data: profile }] = await Promise.all([
    db.from("skills").select("name"),
    db.from("profiles").select("years_experience").eq("id", OWNER_ID).maybeSingle(),
  ]);
  const candidateSkills = (skills ?? []).map((s) => s.name);
  const candidateYears = profile?.years_experience ?? null;

  const results: SourceResult[] = [];
  let totalAdded = 0;

  for (const src of sources) {
    const label = src.label ?? `${src.kind}:${src.board}`;
    const key = sourceKey(src.kind, src.board);
    let fetched = 0, added = 0, error: string | null = null;

    try {
      const jobs = await fetchSource(src.kind, src.board);
      fetched = jobs.length;

      const fresh = await filterExisting(key, jobs);
      const toInsert = fresh.slice(0, MAX_NEW_PER_SOURCE);

      if (toInsert.length) {
        const rows = toInsert.map((j) => {
          const m = scoreMatch({ jobText: `${j.title}\n${j.jobText}`, candidateSkills, candidateYears });
          return {
            source: key, source_id: src.id, external_id: j.externalId,
            title: j.title.slice(0, 200), company: j.company, location: j.location,
            url: j.url, apply_url: j.applyUrl, job_text: j.jobText,
            posted_at: j.postedAt, salary_text: j.salaryText,
            work_mode: j.workMode, job_type: j.jobType,
            required_skills: m.requirements.skills, years_required: m.requirements.yearsRequired,
            match_score: m.matchScore,
            interview_prob_label: m.interviewProbability.label, interview_prob_pct: m.interviewProbability.pct,
            matched_skills: m.matchedSkills, missing_skills: m.missingSkills,
            strengths: m.strengths, weaknesses: m.weaknesses,
            strategy: m.strategy, recommended_resume: m.recommendedResume, model: "deterministic-v1",
          };
        });
        const { data: inserted, error: insErr } = await db
          .from("opportunities").insert(rows).select("id,title,company,job_text");
        if (insErr) throw new Error(insErr.message);
        added = inserted?.length ?? 0;
        totalAdded += added;
        await embedNewRows(inserted ?? []);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.error(`[ingest ${label}]`, error);
    }

    await db.from("job_sources").update({
      last_run_at: new Date().toISOString(),
      last_status: error ? `error: ${error.slice(0, 200)}` : "ok",
      last_count: added,
    }).eq("id", src.id);

    results.push({ sourceId: src.id, label, fetched, added, error });
  }

  return { ran: sources.length, totalAdded, results };
}

/** Keep only jobs whose (source, external_id) is not already stored. */
async function filterExisting(key: string, jobs: NormalizedJob[]): Promise<NormalizedJob[]> {
  if (!jobs.length) return [];
  const db = createDb();
  const ids = jobs.map((j) => j.externalId);
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("opportunities")
      .select("external_id").eq("source", key).in("external_id", ids.slice(i, i + 200));
    for (const r of data ?? []) if (r.external_id) existing.add(r.external_id);
  }
  return jobs.filter((j) => !existing.has(j.externalId));
}

/** Best-effort embeddings for vector match; the feed works fine without them. */
async function embedNewRows(rows: { id: string; title: string; company: string | null; job_text: string | null }[]) {
  if (!rows.length || !process.env.OPENAI_API_KEY) return;
  try {
    const db = createDb();
    const vectors = await embedBatch(rows.map((r) => `${r.title}\n${r.company ?? ""}\n${(r.job_text ?? "").slice(0, 6000)}`));
    await Promise.all(rows.map((r, i) =>
      db.from("opportunities").update({ embedding: JSON.stringify(vectors[i]) }).eq("id", r.id)
    ));
  } catch (e) {
    console.error("[ingest embeddings]", e instanceof Error ? e.message : e);
  }
}
