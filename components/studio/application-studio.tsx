"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, Search, PenLine, Target, ShieldCheck, ArrowRight, ExternalLink,
  BookOpen, FileText,
} from "lucide-react";
import { createCoverLetter, trackApplication, runCompatibilityAnalysis, runHonestTailor, runOptimizedTailor } from "@/actions/studio";
import { buildApplicationChecklist } from "@/lib/domain/coverLetter";
import type { CompatibilityAnalysis, SkillLevel, MatchClassification } from "@/lib/domain/tailorEngine";
import type { TailoringOutput } from "@/actions/studio";
import { Badge, ErrorBanner, ThinkingState } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

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
  "Strong Match": "bg-success/10 text-success border-success/30",
  "Good Match": "bg-primary/10 text-primary border-primary/30",
  "Moderate Match": "bg-warning/10 text-amber-700 border-warning/40 dark:text-amber-400",
  "Weak Match": "bg-orange-500/10 text-orange-600 border-orange-400/40",
  "Very Weak Match": "bg-destructive/10 text-destructive border-destructive/30",
};
const CLASS_RING: Record<MatchClassification, string> = {
  "Strong Match": "border-success text-success",
  "Good Match": "border-primary text-primary",
  "Moderate Match": "border-warning text-amber-600 dark:text-amber-400",
  "Weak Match": "border-orange-500 text-orange-600",
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
  const currentStep = PHASE_STEP[phase];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-y-2">
        {STEPS.map((s, i) => {
          const done = i < currentStep;
          const current = i === currentStep;
          return (
            <li key={s} className="flex items-center">
              <span className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200",
                current ? "bg-primary/10 text-primary" : done ? "text-foreground" : "text-muted-foreground/60"
              )}>
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200",
                  done ? "bg-success text-success-foreground" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <span aria-hidden className={cn("mx-1 hidden h-px w-5 sm:block", done ? "bg-success/50" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* ── STEP 1: Select Job ────────────────────────────────────────────── */}
      <section className={cn("card animate-fade-up p-5 transition-opacity sm:p-6", phase !== "setup" && "opacity-60")}>
        <StepTitle n={1} title="Select job & résumé" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="studio-resume" className="field-label">Résumé</label>
            <select id="studio-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={phase !== "setup"} className="field">
              {resumes.length === 0 && <option value="">No résumés — add one first</option>}
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="studio-opp" className="field-label">Saved opportunity (optional)</label>
            <select id="studio-opp" value={oppId} onChange={(e) => pickOpportunity(e.target.value)} disabled={phase !== "setup"} className="field">
              <option value="">— paste a job below —</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}{o.company ? ` · ${o.company}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title *" disabled={phase !== "setup"} className="field" aria-label="Job title" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" disabled={phase !== "setup"} className="field" aria-label="Company" />
          <input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="Application link (https://…)" disabled={phase !== "setup"} className="field" aria-label="Application link" />
        </div>
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={6}
          placeholder="Paste the full job description here *" disabled={phase !== "setup"}
          className="field mt-4" aria-label="Job description" />
        {phase === "setup" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={runAnalysis} disabled={!canAnalyze || busy} className="btn-primary">
              {busy ? "Analyzing…" : <>Analyze Compatibility <ArrowRight className="h-4 w-4" /></>}
            </button>
            {!canAnalyze && (
              <p className="text-xs text-muted-foreground">
                {!resumeId ? "Add a résumé first." : jobTitle.trim().length < 2 ? "Enter the job title." : "Paste the job description (30+ characters)."}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── STEP 2: Compatibility Analysis + Decision ─────────────────────── */}
      {compatibility && (phase === "compatibility" || PHASE_STEP[phase] > 1) && (
        <section className="card animate-fade-up p-5 sm:p-6">
          <StepTitle n={2} title="JD compatibility analysis" />

          {/* Score + classification */}
          <div className="mt-5 flex flex-wrap items-start gap-6">
            <div className="text-center">
              <div className={cn("flex h-24 w-24 items-center justify-center rounded-full border-4 text-3xl font-bold tabular-nums", CLASS_RING[compatibility.classification])}>
                {compatibility.matchScore}%
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Current match</p>
            </div>
            <div className="flex-1 space-y-2.5">
              <span className={cn("inline-block rounded-full border px-3 py-1 text-xs font-semibold", CLASS_COLORS[compatibility.classification])}>
                {compatibility.classification}
              </span>
              {compatibility.isCareerTransition && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  Career transition opportunity detected — transferable skills can bridge the gap.
                </div>
              )}
              <p className="text-sm leading-relaxed text-muted-foreground">
                We identified <strong className="text-foreground">{compatibility.missingKeywordCount} missing keywords</strong> · {compatibility.transferableSkills.length} transferable skills · {compatibility.weakBulletCount} weak bullets
              </p>
              <p className="text-sm">
                Estimated match after optimization:{" "}
                <strong className="text-primary">{compatibility.matchScore}% → {compatibility.estimatedAfterRange.min}–{compatibility.estimatedAfterRange.max}%</strong>
              </p>
            </div>
          </div>

          {/* Three columns */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <AnalysisColumn label="Strengths" labelClass="text-success" surface="border-success/20 bg-success/5">
              {compatibility.matchedSkills.length > 0
                ? compatibility.matchedSkills.slice(0, 8).map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm"><Check className="h-3.5 w-3.5 shrink-0 text-success" />{s}</li>
                  ))
                : <p className="text-xs text-muted-foreground">No direct skill matches yet</p>}
            </AnalysisColumn>
            <AnalysisColumn label="Missing" labelClass="text-destructive" surface="border-destructive/20 bg-destructive/5">
              {compatibility.missingSkills.length > 0
                ? compatibility.missingSkills.slice(0, 8).map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm"><span aria-hidden className="text-destructive">✗</span>{s}</li>
                  ))
                : <p className="text-xs text-muted-foreground">Nothing critical missing</p>}
            </AnalysisColumn>
            <AnalysisColumn label="Transferable" labelClass="text-secondary" surface="border-border bg-muted/40">
              {compatibility.transferableSkills.length > 0
                ? compatibility.transferableSkills.slice(0, 6).map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm"><ArrowRight className="h-3.5 w-3.5 shrink-0 -rotate-45 text-secondary" />{s}</li>
                  ))
                : <p className="text-xs text-muted-foreground">—</p>}
            </AnalysisColumn>
          </div>

          {/* Decision cards — only on compatibility phase */}
          {phase === "compatibility" && (
            <>
              <p className="mt-7 text-sm font-semibold">How would you like to proceed?</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {/* Better Jobs */}
                <Link href="/app/opportunities" className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-background p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-muted-foreground/40 hover:shadow-card">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted"><Search className="h-4 w-4 text-muted-foreground" /></span>
                  <span className="text-sm font-semibold">Recommend Better Jobs</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">Find roles that better match your current profile — no changes needed.</span>
                </Link>
                {/* Honest Tailoring */}
                <button onClick={chooseHonest} disabled={busy}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-success/40 bg-success/5 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-success hover:shadow-card disabled:opacity-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><PenLine className="h-4 w-4 text-success" /></span>
                  <span className="text-sm font-semibold">Honest Tailoring</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">Rewrite bullets, surface existing keywords, highlight transferable skills. <strong>No invented content.</strong></span>
                  <Badge tone="ok" className="mt-auto self-start">Expected ATS: 55–75%</Badge>
                </button>
                {/* Optimize */}
                <button onClick={() => setPhase("confirming-skills")} disabled={busy || compatibility.missingSkills.length === 0}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-glow disabled:opacity-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Target className="h-4 w-4 text-primary" /></span>
                  <span className="text-sm font-semibold">Optimize For This Job</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">Tell us which missing skills you actually have — only confirmed skills get added. <strong>Never fabricated.</strong></span>
                  <Badge tone="primary" className="mt-auto self-start">Expected ATS: 75–88%</Badge>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── STEP 3: Skill Confirmation (Optimize path only) ───────────────── */}
      {phase === "confirming-skills" && compatibility && (
        <section className="card animate-fade-up p-5 sm:p-6">
          <StepTitle n={3} title="Confirm your skills" />
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Only check skills where you have <strong className="text-foreground">actual knowledge</strong>. We will never add a skill you do not confirm.
          </p>
          {compatibility.missingSkills.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No missing skills — your résumé already covers the JD keywords.</p>
          ) : (
            <ul className="mt-5 space-y-2.5">
              {compatibility.missingSkills.map((skill) => {
                const state = skillConfirms[skill] ?? { confirmed: false, level: "beginner" as SkillLevel };
                return (
                  <li key={skill} className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    state.confirmed ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                  )}>
                    <input type="checkbox" id={`skill-${skill}`} checked={state.confirmed}
                      onChange={(e) => setSkillConfirms((p) => ({ ...p, [skill]: { ...p[skill], confirmed: e.target.checked } }))}
                      className="h-4 w-4 rounded accent-primary" />
                    <label htmlFor={`skill-${skill}`} className="flex-1 cursor-pointer text-sm font-medium">{skill}</label>
                    {state.confirmed && (
                      <select value={state.level} aria-label={`${skill} level`}
                        onChange={(e) => setSkillConfirms((p) => ({ ...p, [skill]: { ...p[skill], level: e.target.value as SkillLevel } }))}
                        className="field w-auto px-2.5 py-1.5 text-xs">
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
          <div className="mt-5 flex gap-2">
            <button onClick={() => setPhase("compatibility")} className="btn-outline">← Back</button>
            <button onClick={runOptimize} disabled={busy} className="btn-primary">
              {busy ? "Optimizing…" : <>Optimize Now <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </section>
      )}

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {(phase === "analyzing" || phase === "tailoring") && (
        <ThinkingState
          label={phase === "analyzing" ? "Analyzing compatibility…" : "Generating optimized résumé…"}
          sublabel={phase === "analyzing" ? "Matching your résumé against the job description" : "Rewriting sections with only the skills you confirmed"}
        />
      )}

      {/* ── STEP 4: Tailoring Report ──────────────────────────────────────── */}
      {tailoring && (phase === "report" || PHASE_STEP[phase] > 3) && (
        <section className="card animate-fade-up p-5 sm:p-6">
          <StepTitle n={4} title="Tailoring report" />

          {/* Score delta row */}
          <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="min-w-28 rounded-2xl border border-border bg-muted/40 px-6 py-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Match before</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{tailoring.beforeScore}%</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
            <div className="min-w-28 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Match after</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-primary">{tailoring.afterScore}%</p>
            </div>
            <div className="min-w-28 rounded-2xl border border-success/30 bg-success/5 px-6 py-4 text-center">
              <p className="text-xs font-medium text-muted-foreground">Improvement</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-success">+{improvement}%</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {/* Sections modified */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sections modified</p>
              <ul className="space-y-1.5">
                {tailoring.sectionsModified.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{s}</li>
                ))}
                {tailoring.sectionsModified.length === 0 && <li className="text-xs text-muted-foreground">Minimal changes needed</li>}
              </ul>
            </div>

            {/* Keywords + transferable */}
            <div className="space-y-5">
              {tailoring.keywordsAdded.length > 0 && (
                <div>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keywords added</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoring.keywordsAdded.map((k) => <Badge key={k} tone="primary">{k}</Badge>)}
                  </div>
                </div>
              )}
              {tailoring.transferableSkillsUsed.length > 0 && (
                <div>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transferable skills used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tailoring.transferableSkillsUsed.map((s) => <Badge key={s}>{s}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Integrity verification */}
          <div className="mt-6 rounded-2xl border border-success/25 bg-success/5 p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
              <ShieldCheck className="h-4 w-4" /> Integrity verification
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {(["No fake experience added", "No fake projects added", "No fake certifications added", "No fabricated achievements"] as const).map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-success">
                  <Check className="h-4 w-4 shrink-0" />{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Optimized résumé preview */}
          <details className="group mt-5 overflow-hidden rounded-xl border border-border">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              View optimized résumé
            </summary>
            <pre className="overflow-x-auto whitespace-pre-wrap border-t border-border bg-muted/30 px-4 py-3 text-xs leading-relaxed">{tailoring.contentMd}</pre>
          </details>

          {/* Learning roadmap (when match < 70) */}
          {tailoring.learningRoadmap && (
            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <BookOpen className="h-4 w-4" /> Learning roadmap — close the remaining gap
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {tailoring.learningRoadmap.items.map((item) => (
                  <Badge key={item.skill} tone={item.priority === "high" ? "gap" : item.priority === "medium" ? "warn" : "neutral"}>
                    {item.skill} · {item.weeks}w
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 text-xs sm:grid-cols-3">
                {([["30-Day", tailoring.learningRoadmap.plan30], ["60-Day", tailoring.learningRoadmap.plan60], ["90-Day", tailoring.learningRoadmap.plan90]] as const).map(([label, steps]) => (
                  <div key={label} className="rounded-xl border border-border bg-background p-3.5">
                    <p className="mb-1.5 font-semibold">{label} plan</p>
                    <ul className="space-y-1">{steps.map((s, i) => <li key={i} className="leading-relaxed text-muted-foreground">• {s}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "report" && (
            <button onClick={genLetter} disabled={busy} className="btn-primary mt-5">
              {busy ? "Writing cover letter…" : <>Generate Cover Letter <ArrowRight className="h-4 w-4" /></>}
            </button>
          )}
        </section>
      )}

      {/* ── STEP 5: Cover Letter ──────────────────────────────────────────── */}
      {letter && (phase === "cover-letter" || phase === "apply") && (
        <section className="card animate-fade-up p-5 sm:p-6">
          <StepTitle n={5} title="Cover letter" />
          <p className="mt-1.5 text-xs text-muted-foreground">{letter.title}{letter.id ? " · saved to Documents" : ""}</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background p-5 text-sm leading-relaxed">{letter.content}</pre>
          {phase === "cover-letter" && (
            <button onClick={() => setPhase("apply")} className="btn-primary mt-5">
              Apply &amp; Track <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </section>
      )}

      {/* ── STEP 6: Apply & Track ─────────────────────────────────────────── */}
      {phase === "apply" && (
        <section className="card animate-fade-up p-5 sm:p-6">
          <StepTitle n={6} title="Apply assistant" />
          <ul className="mt-4 space-y-2.5">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <input type="checkbox" id={`check-${c.id}`} checked={!!checked[c.id]} onChange={(e) => setChecked({ ...checked, [c.id]: e.target.checked })} className="mt-1 h-4 w-4 rounded accent-primary" />
                <label htmlFor={`check-${c.id}`} className="cursor-pointer">
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {applyUrl && (
              <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <ExternalLink className="h-4 w-4" /> Open application page
              </a>
            )}
            {trackedId ? (
              <Link href="/app/applications" className="btn-success">
                <Check className="h-4 w-4" /> Tracked — view pipeline
              </Link>
            ) : (
              <button onClick={track} disabled={busy} className="btn-primary">
                {busy ? "Tracking…" : "Track this application"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------------- small presentational pieces ---------------- */

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{n}</span>
      {title}
    </h2>
  );
}

function AnalysisColumn({ label, labelClass, surface, children }: {
  label: string; labelClass: string; surface: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4", surface)}>
      <p className={cn("mb-2.5 text-xs font-semibold uppercase tracking-wider", labelClass)}>{label}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}
