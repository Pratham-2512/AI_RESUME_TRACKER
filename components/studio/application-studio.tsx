"use client";

import { useState } from "react";
import Link from "next/link";
import { createCoverLetter, trackApplication } from "@/actions/studio";
import { buildApplicationChecklist } from "@/lib/domain/coverLetter";

type Resume = { id: string; label: string | null };
type Opportunity = { id: string; title: string; company: string | null; job_text: string | null; url: string | null };

type TailorReport = {
  matchScore: number;
  interviewProbability: { label: string; pct: number };
  matchedSkills: string[]; missingSkills: string[];
  bulletImprovements: { original: string; issues: string[]; suggestion: string }[];
  strengths: string[]; weaknesses: string[]; recommendations: string[];
  recommendedResume: string;
};
type Rewrite = { id: string | null; version_no: number; content_md: string; after_score: number };
type Letter = { id: string | null; title: string; content: string; matchedSkills: string[] };

const STEPS = ["Select Job", "Analyze JD", "Tailored Résumé", "Cover Letter", "Apply & Track"] as const;

export function ApplicationStudio({ resumes, opportunities }: { resumes: Resume[]; opportunities: Opportunity[] }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — job + résumé selection
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [oppId, setOppId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [applyUrl, setApplyUrl] = useState("");

  // Step results
  const [report, setReport] = useState<TailorReport | null>(null);
  const [rewrite, setRewrite] = useState<Rewrite | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [trackedId, setTrackedId] = useState<string | null>(null);

  function pickOpportunity(id: string) {
    setOppId(id);
    const o = opportunities.find((x) => x.id === id);
    if (o) {
      setJobTitle(o.title);
      setCompany(o.company ?? "");
      setJdText(o.job_text ?? "");
      setApplyUrl(o.url ?? "");
    }
  }

  async function analyze() {
    setBusy("analyze"); setError(null);
    try {
      const r = await fetch("/api/resume/tailor", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId, jdText }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setReport(j.data.report ?? j.data);
      setStep(1);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setBusy(null); }
  }

  async function tailorResume() {
    setBusy("tailor"); setError(null);
    try {
      const r = await fetch("/api/ai/resume/rewrite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId, target: report?.recommendedResume ?? "ats" }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setRewrite(j.data);
      setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Tailoring failed"); }
    finally { setBusy(null); }
  }

  async function genLetter() {
    setBusy("letter"); setError(null);
    try {
      const result = await createCoverLetter({ resumeId, jobTitle, company: company || undefined, jdText, opportunityId: oppId || null });
      setLetter(result);
      setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Cover letter failed"); }
    finally { setBusy(null); }
  }

  async function track() {
    setBusy("track"); setError(null);
    try {
      const id = await trackApplication({ jobTitle, company: company || undefined, opportunityId: oppId || null, notes: applyUrl ? `Applied via ${applyUrl}` : undefined });
      setTrackedId(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Tracking failed"); }
    finally { setBusy(null); }
  }

  const canAnalyze = resumeId && jobTitle.trim().length >= 2 && jdText.trim().length >= 30;
  const checklist = buildApplicationChecklist({ hasTailoredResume: !!rewrite, hasCoverLetter: !!letter, company: company || null });

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium
            ${i < step + 1 ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i < step + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {/* STEP 1 — Select job */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">1 · Select job &amp; résumé</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Résumé</label>
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              {resumes.length === 0 && <option value="">No résumés — add one first</option>}
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Saved opportunity (optional)</label>
            <select value={oppId} onChange={(e) => pickOpportunity(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="">— paste a job below —</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}{o.company ? ` · ${o.company}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title *" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="Application link (https://…)" className="rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={6} placeholder="Paste the full job description here *"
          className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <button onClick={analyze} disabled={!canAnalyze || busy !== null}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy === "analyze" ? "Analyzing…" : "Analyze JD →"}
        </button>
      </section>

      {/* STEP 2 — Analysis / comparison */}
      {report && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">2 · JD analysis &amp; résumé comparison</h2>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <div className="text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary text-2xl font-bold text-primary">{report.matchScore}%</div>
              <p className="mt-1 text-xs text-muted-foreground">Match</p>
            </div>
            <div className="min-w-48 flex-1 space-y-2 text-sm">
              <p><span className="font-medium text-emerald-600 dark:text-emerald-400">Why matched:</span> {report.matchedSkills.slice(0, 8).join(", ") || "—"}</p>
              <p><span className="font-medium text-destructive">Missing:</span> {report.missingSkills.slice(0, 8).join(", ") || "nothing critical"}</p>
              <p className="text-muted-foreground">Interview probability: {report.interviewProbability.label} (~{report.interviewProbability.pct}%)</p>
            </div>
          </div>
          {report.recommendations.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {report.recommendations.slice(0, 4).map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          )}
          <button onClick={tailorResume} disabled={busy !== null}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy === "tailor" ? "Tailoring…" : "Generate tailored résumé →"}
          </button>
        </section>
      )}

      {/* STEP 3 — Tailored résumé */}
      {rewrite && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">3 · Tailored résumé <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">ATS {rewrite.after_score}</span></h2>
          <details className="mt-3 rounded-md border">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">View tailored version (v{rewrite.version_no})</summary>
            <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-sm">{rewrite.content_md}</pre>
          </details>
          <button onClick={genLetter} disabled={busy !== null}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy === "letter" ? "Writing…" : "Generate cover letter →"}
          </button>
        </section>
      )}

      {/* STEP 4 — Cover letter */}
      {letter && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">4 · Cover letter</h2>
          <p className="mt-1 text-xs text-muted-foreground">{letter.title}{letter.id ? " · saved to Documents" : ""}</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-background p-4 text-sm">{letter.content}</pre>
          <button onClick={() => setStep(4)} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Apply &amp; track →
          </button>
        </section>
      )}

      {/* STEP 5 — Apply assistant */}
      {step >= 4 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">5 · Apply assistant</h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-md border bg-background p-3">
                <input type="checkbox" checked={!!checked[c.id]} onChange={(e) => setChecked({ ...checked, [c.id]: e.target.checked })} className="mt-1" />
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {applyUrl && (
              <a href={applyUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">↗ Open application page</a>
            )}
            {trackedId ? (
              <Link href="/app/applications" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">✓ Tracked — view pipeline</Link>
            ) : (
              <button onClick={track} disabled={busy !== null}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {busy === "track" ? "Tracking…" : "Track this application"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
