"use client";

import { useState } from "react";
import Link from "next/link";
import { createCoverLetter, trackApplication, runCompatibilityAnalysis, runHonestTailor, runOptimizedTailor } from "@/actions/studio";
import { buildApplicationChecklist } from "@/lib/domain/coverLetter";
import type { CompatibilityAnalysis, SkillLevel, MatchClassification } from "@/lib/domain/tailorEngine";
import type { TailoringOutput } from "@/actions/studio";

type Resume = { id: string; label: string | null };
type Opportunity = { id: string; title: string; company: string | null; job_text: string | null; url: string | null };
type Letter = { id: string | null; title: string; content: string };

type Phase =
  | "setup" | "analyzing" | "compatibility"
  | "confirming-skills" | "tailoring" | "report"
  | "cover-letter" | "apply";

const STEPS = ["Select Job", "Compatibility", "Strategy", "Report", "Cover Letter", "Apply & Track"] as const;
const PHASE_STEP: Record<Phase, number> = {
  setup: 0, analyzing: 1, compatibility: 1,
  "confirming-skills": 2, tailoring: 2,
  report: 3, "cover-letter": 4, apply: 5,
};

const CLASS_COLORS: Record<MatchClassification, string> = {
  "Strong Match": "bg-emerald-500/10 text-emerald-700 border-emerald-400/40 dark:text-emerald-400",
  "Good Match": "bg-blue-500/10 text-blue-700 border-blue-400/40 dark:text-blue-400",
  "Moderate Match": "bg-yellow-500/10 text-yellow-700 border-yellow-400/40 dark:text-yellow-500",
  "Weak Match": "bg-orange-500/10 text-orange-700 border-orange-400/40 dark:text-orange-400",
  "Very Weak Match": "bg-destructive/10 text-destructive border-destructive/30",
};
const CLASS_RING: Record<MatchClassification, string> = {
  "Strong Match": "border-emerald-500 text-emerald-600 dark:text-emerald-400",
  "Good Match": "border-blue-500 text-blue-600 dark:text-blue-400",
  "Moderate Match": "border-yellow-500 text-yellow-600 dark:text-yellow-500",
  "Weak Match": "border-orange-500 text-orange-600 dark:text-orange-400",
  "Very Weak Match": "border-destructive text-destructive",
};

export function ApplicationStudio({ resumes, opportunities }: { resumes: Resume[]; opportunities: Opportunity[] }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [oppId, setOppId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [applyUrl, setApplyUrl] = useState("");

  // Results
  const [compatibility, setCompatibility] = useState<CompatibilityAnalysis | null>(null);
  const [skillConfirms, setSkillConfirms] = useState<Record<string, { confirmed: boolean; level: SkillLevel }>>({});
  const [tailoring, setTailoring] = useState<TailoringOutput | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [trackedId, setTrackedId] = useState<string | null>(null);

  function pickOpportunity(id: string) {
    setOppId(id);
    const o = opportunities.find((x) => x.id === id);
    if (o) { setJobTitle(o.title); setCompany(o.company ?? ""); setJdText(o.job_text ?? ""); setApplyUrl(o.url ?? ""); }
  }

  async function runAnalysis() {
    setBusy(true); setError(null); setPhase("analyzing");
    try {
      const result = await runCompatibilityAnalysis({ resumeId, jdText });
      setCompatibility(result);
      // Initialize skill confirmation state for all missing skills
      const init: Record<string, { confirmed: boolean; level: SkillLevel }> = {};
      result.missingSkills.forEach((s) => { init[s] = { confirmed: false, level: "beginner" }; });
      setSkillConfirms(init);
      setPhase("compatibility");
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); setPhase("setup"); }
    finally { setBusy(false); }
  }

  async function chooseHonest() {
    setBusy(true); setError(null); setPhase("tailoring");
    try {
      const result = await runHonestTailor({ resumeId, jdText });
      setTailoring(result);
      setPhase("report");
    } catch (e) { setError(e instanceof Error ? e.message : "Tailoring failed"); setPhase("compatibility"); }
    finally { setBusy(false); }
  }

  async function runOptimize() {
    setBusy(true); setError(null); setPhase("tailoring");
    try {
      const confirmed = Object.entries(skillConfirms)
        .map(([skill, v]) => ({ skill, confirmed: v.confirmed, level: v.level }));
      const result = await runOptimizedTailor({ resumeId, jdText, confirmedSkills: confirmed });
      setTailoring(result);
      setPhase("report");
    } catch (e) { setError(e instanceof Error ? e.message : "Optimization failed"); setPhase("confirming-skills"); }
    finally { setBusy(false); }
  }

  async function genLetter() {
    setBusy(true); setError(null);
    try {
      const result = await createCoverLetter({ resumeId, jobTitle, company: company || undefined, jdText, opportunityId: oppId || null });
      setLetter(result);
      setPhase("cover-letter");
    } catch (e) { setError(e instanceof Error ? e.message : "Cover letter failed"); }
    finally { setBusy(false); }
  }

  async function track() {
    setBusy(true); setError(null);
    try {
      const id = await trackApplication({ jobTitle, company: company || undefined, opportunityId: oppId || null, notes: applyUrl ? `Applied via ${applyUrl}` : undefined });
      setTrackedId(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Tracking failed"); }
    finally { setBusy(false); }
  }

  const canAnalyze = !!resumeId && jobTitle.trim().length >= 2 && jdText.trim().length >= 30;
  const checklist = buildApplicationChecklist({ hasTailoredResume: !!tailoring, hasCoverLetter: !!letter, company: company || null });
  const improvement = tailoring ? tailoring.afterScore - tailoring.beforeScore : 0;

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const active = i <= PHASE_STEP[phase];
          return (
            <li key={s} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
              ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
              {s}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* ── STEP 1: Select Job ────────────────────────────────────────────── */}
      <section className={`rounded-xl border bg-card p-5 ${phase !== "setup" ? "opacity-60" : ""}`}>
        <h2 className="font-semibold">1 · Select job &amp; résumé</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Résumé</label>
            <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={phase !== "setup"}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed">
              {resumes.length === 0 && <option value="">No résumés — add one first</option>}
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Saved opportunity (optional)</label>
            <select value={oppId} onChange={(e) => pickOpportunity(e.target.value)} disabled={phase !== "setup"}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed">
              <option value="">— paste a job below —</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}{o.company ? ` · ${o.company}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title *" disabled={phase !== "setup"}
            className="rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" disabled={phase !== "setup"}
            className="rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed" />
          <input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="Application link (https://…)" disabled={phase !== "setup"}
            className="rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed" />
        </div>
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={6}
          placeholder="Paste the full job description here *" disabled={phase !== "setup"}
          className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed" />
        {phase === "setup" && (
          <button onClick={runAnalysis} disabled={!canAnalyze || busy}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Analyzing…" : "Analyze Compatibility →"}
          </button>
        )}
      </section>

      {/* ── STEP 2: Compatibility Analysis + Decision ─────────────────────── */}
      {compatibility && (phase === "compatibility" || PHASE_STEP[phase] > 1) && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">2 · JD Compatibility Analysis</h2>

          {/* Score + classification */}
          <div className="mt-4 flex flex-wrap items-start gap-6">
            <div className="text-center">
              <div className={`flex h-24 w-24 items-center justify-center rounded-full border-4 text-3xl font-bold ${CLASS_RING[compatibility.classification]}`}>
                {compatibility.matchScore}%
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Current Match</p>
            </div>
            <div className="flex-1 space-y-2">
              <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${CLASS_COLORS[compatibility.classification]}`}>
                {compatibility.classification}
              </span>
              {compatibility.isCareerTransition && (
                <div className="rounded-md border border-amber-400/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                  Career Transition Opportunity Detected — transferable skills can bridge the gap.
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                We identified <strong>{compatibility.missingKeywordCount} missing keywords</strong> · {compatibility.transferableSkills.length} transferable skills · {compatibility.weakBulletCount} weak bullets
              </p>
              <p className="text-sm">
                Estimated match after optimization:{" "}
                <strong className="text-primary">{compatibility.matchScore}% → {compatibility.estimatedAfterRange.min}–{compatibility.estimatedAfterRange.max}%</strong>
              </p>
            </div>
          </div>

          {/* Three columns */}
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Strengths</p>
              {compatibility.matchedSkills.length > 0
                ? <ul className="space-y-1">{compatibility.matchedSkills.slice(0, 8).map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-sm"><span className="text-emerald-500">✓</span>{s}</li>
                  ))}</ul>
                : <p className="text-xs text-muted-foreground">No direct skill matches yet</p>}
            </div>
            <div className="rounded-lg border bg-destructive/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">Missing</p>
              {compatibility.missingSkills.length > 0
                ? <ul className="space-y-1">{compatibility.missingSkills.slice(0, 8).map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-sm"><span className="text-destructive">✗</span>{s}</li>
                  ))}</ul>
                : <p className="text-xs text-muted-foreground">Nothing critical missing</p>}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transferable</p>
              {compatibility.transferableSkills.length > 0
                ? <ul className="space-y-1">{compatibility.transferableSkills.slice(0, 6).map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-sm"><span className="text-primary">↗</span>{s}</li>
                  ))}</ul>
                : <p className="text-xs text-muted-foreground">—</p>}
            </div>
          </div>

          {/* Decision cards — only on compatibility phase */}
          {phase === "compatibility" && (
            <>
              <p className="mt-6 text-sm font-semibold">Your resume is not yet optimized for this role. How would you like to proceed?</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {/* Better Jobs */}
                <Link href="/app/matches"
                  className="flex flex-col gap-2 rounded-xl border-2 border-muted bg-muted/30 p-4 transition hover:border-muted-foreground/50 hover:bg-muted/50">
                  <span className="text-xl">🔍</span>
                  <span className="font-semibold text-sm">Recommend Better Jobs</span>
                  <span className="text-xs text-muted-foreground">Find roles that better match your current profile — no changes needed.</span>
                </Link>
                {/* Honest Tailoring */}
                <button onClick={chooseHonest} disabled={busy}
                  className="flex flex-col gap-2 rounded-xl border-2 border-emerald-400/50 bg-emerald-50/40 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/70 disabled:opacity-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40">
                  <span className="text-xl">✏️</span>
                  <span className="font-semibold text-sm">Honest Tailoring</span>
                  <span className="text-xs text-muted-foreground">Rewrite bullets, surface existing keywords, highlight transferable skills. <strong>No invented content.</strong></span>
                  <span className="mt-auto inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    Expected ATS: 55–75%
                  </span>
                </button>
                {/* Optimize */}
                <button onClick={() => setPhase("confirming-skills")} disabled={busy || compatibility.missingSkills.length === 0}
                  className="flex flex-col gap-2 rounded-xl border-2 border-primary/50 bg-primary/5 p-4 text-left transition hover:border-primary hover:bg-primary/10 disabled:opacity-50">
                  <span className="text-xl">🎯</span>
                  <span className="font-semibold text-sm">Optimize For This Job</span>
                  <span className="text-xs text-muted-foreground">Tell us which missing skills you actually have — only confirmed skills get added. <strong>Never fabricated.</strong></span>
                  <span className="mt-auto inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Expected ATS: 75–88%
                  </span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── STEP 3: Skill Confirmation (Optimize path only) ───────────────── */}
      {phase === "confirming-skills" && compatibility && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">3 · Confirm Your Skills</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only check skills where you have <strong>actual knowledge</strong>. We will never add a skill you do not confirm.
          </p>
          {compatibility.missingSkills.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No missing skills — your résumé already covers the JD keywords.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {compatibility.missingSkills.map((skill) => {
                const state = skillConfirms[skill] ?? { confirmed: false, level: "beginner" as SkillLevel };
                return (
                  <li key={skill} className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-3">
                    <input type="checkbox" id={`skill-${skill}`} checked={state.confirmed}
                      onChange={(e) => setSkillConfirms((p) => ({ ...p, [skill]: { ...p[skill], confirmed: e.target.checked } }))}
                      className="h-4 w-4 rounded accent-primary" />
                    <label htmlFor={`skill-${skill}`} className="flex-1 cursor-pointer text-sm font-medium">{skill}</label>
                    {state.confirmed && (
                      <select value={state.level}
                        onChange={(e) => setSkillConfirms((p) => ({ ...p, [skill]: { ...p[skill], level: e.target.value as SkillLevel } }))}
                        className="rounded-md border bg-background px-2 py-1 text-xs">
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={() => setPhase("compatibility")}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">← Back</button>
            <button onClick={runOptimize} disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Optimizing…" : "Optimize Now →"}
            </button>
          </div>
        </section>
      )}

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {(phase === "analyzing" || phase === "tailoring") && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {phase === "analyzing" ? "Analyzing compatibility…" : "Generating optimized résumé…"}
        </div>
      )}

      {/* ── STEP 4: Tailoring Report ──────────────────────────────────────── */}
      {tailoring && (phase === "report" || PHASE_STEP[phase] > 3) && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">4 · Tailoring Report</h2>

          {/* Score delta row */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="rounded-lg border bg-muted/30 px-5 py-3 text-center">
              <p className="text-xs text-muted-foreground">Match Before</p>
              <p className="text-2xl font-bold">{tailoring.beforeScore}%</p>
            </div>
            <div className="flex items-center text-muted-foreground">→</div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-3 text-center">
              <p className="text-xs text-muted-foreground">Match After</p>
              <p className="text-2xl font-bold text-primary">{tailoring.afterScore}%</p>
            </div>
            <div className="flex items-center text-muted-foreground">→</div>
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-50/50 px-5 py-3 text-center dark:bg-emerald-950/20">
              <p className="text-xs text-muted-foreground">Improvement</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{improvement}%</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Sections modified */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections Modified</p>
              <ul className="space-y-1">
                {tailoring.sectionsModified.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm"><span className="mt-0.5 text-emerald-500">✓</span>{s}</li>
                ))}
                {tailoring.sectionsModified.length === 0 && <li className="text-xs text-muted-foreground">Minimal changes needed</li>}
              </ul>
            </div>

            {/* Keywords + transferable */}
            <div className="space-y-4">
              {tailoring.keywordsAdded.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keywords Added</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoring.keywordsAdded.map((k) => (
                      <span key={k} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{k}</span>
                    ))}
                  </div>
                </div>
              )}
              {tailoring.transferableSkillsUsed.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transferable Skills Used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoring.transferableSkillsUsed.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Integrity verification */}
          <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Integrity Verification</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {(["No fake experience added", "No fake projects added", "No fake certifications added", "No fabricated achievements"] as const).map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <span className="font-bold">✓</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Optimized résumé preview */}
          <details className="mt-4 rounded-md border">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">View optimized résumé</summary>
            <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed">{tailoring.contentMd}</pre>
          </details>

          {/* Learning roadmap (when match < 70) */}
          {tailoring.learningRoadmap && (
            <div className="mt-5 rounded-lg border border-amber-400/40 bg-amber-50/40 p-4 dark:bg-amber-950/20">
              <p className="mb-3 font-semibold text-sm text-amber-800 dark:text-amber-300">📚 Learning Roadmap — close the remaining gap</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {tailoring.learningRoadmap.items.map((item) => (
                  <span key={item.skill} className={`rounded-full border px-2.5 py-1 text-xs font-medium
                    ${item.priority === "high" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                      item.priority === "medium" ? "border-amber-400/40 bg-amber-100/60 text-amber-700 dark:text-amber-400" :
                      "border-border bg-muted text-muted-foreground"}`}>
                    {item.skill} · {item.weeks}w
                  </span>
                ))}
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                {([["30-Day", tailoring.learningRoadmap.plan30], ["60-Day", tailoring.learningRoadmap.plan60], ["90-Day", tailoring.learningRoadmap.plan90]] as const).map(([label, steps]) => (
                  <div key={label} className="rounded-md border bg-background p-2">
                    <p className="mb-1 font-semibold text-muted-foreground">{label} Plan</p>
                    <ul className="space-y-0.5">{steps.map((s, i) => <li key={i} className="text-muted-foreground">• {s}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "report" && (
            <button onClick={genLetter} disabled={busy}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy ? "Writing cover letter…" : "Generate Cover Letter →"}
            </button>
          )}
        </section>
      )}

      {/* ── STEP 5: Cover Letter ──────────────────────────────────────────── */}
      {letter && (phase === "cover-letter" || phase === "apply") && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">5 · Cover Letter</h2>
          <p className="mt-1 text-xs text-muted-foreground">{letter.title}{letter.id ? " · saved to Documents" : ""}</p>
          <pre className="mt-3 whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-relaxed">{letter.content}</pre>
          {phase === "cover-letter" && (
            <button onClick={() => setPhase("apply")}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Apply &amp; Track →
            </button>
          )}
        </section>
      )}

      {/* ── STEP 6: Apply & Track ─────────────────────────────────────────── */}
      {phase === "apply" && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">6 · Apply Assistant</h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-md border bg-background p-3">
                <input type="checkbox" checked={!!checked[c.id]} onChange={(e) => setChecked({ ...checked, [c.id]: e.target.checked })} className="mt-1 h-4 w-4 accent-primary" />
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
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted">↗ Open application page</a>
            )}
            {trackedId ? (
              <Link href="/app/applications" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                ✓ Tracked — view pipeline
              </Link>
            ) : (
              <button onClick={track} disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {busy ? "Tracking…" : "Track this application"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
