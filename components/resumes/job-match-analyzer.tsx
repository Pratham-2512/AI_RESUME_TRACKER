"use client";

import { useState } from "react";
import type { MatchResult } from "@/lib/domain/jdMatcher";

type Version = { id: string; version_no: number; ats_score: number | null; content_md: string | null };

interface Props {
  resumeId: string;
  onVersionAdded?: (v: Version) => void;
}

type Phase = "idle" | "analyzing" | "analyzed" | "optimizing" | "optimized";

export function JobMatchAnalyzer({ resumeId, onVersionAdded }: Props) {
  const [jd, setJd] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [optimized, setOptimized] = useState<{ content_md: string; before_score: number; after_score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function analyze() {
    if (!jd.trim()) return;
    setPhase("analyzing");
    setError(null);
    setMatch(null);
    setOptimized(null);
    try {
      const r = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId, jobDescription: jd }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMatch(j.data as MatchResult);
      setPhase("analyzed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("idle");
    }
  }

  async function optimize() {
    if (!match) return;
    setPhase("optimizing");
    setError(null);
    try {
      const r = await fetch("/api/ai/resume/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resumeId,
          target: match.suggestedTarget,
          jdKeywords: match.missingKeywords,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setOptimized({ content_md: j.data.content_md, before_score: j.data.before_score, after_score: j.data.after_score });
      if (onVersionAdded) {
        onVersionAdded({ id: j.data.id, version_no: j.data.version_no, ats_score: j.data.after_score, content_md: j.data.content_md });
      }
      setPhase("optimized");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
      setPhase("analyzed");
    }
  }

  async function copyOptimized() {
    if (!optimized?.content_md) return;
    await navigator.clipboard.writeText(optimized.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    s >= 60 ? "text-amber-600 dark:text-amber-400" : "text-destructive";

  const matchBarColor = (p: number) =>
    p >= 70 ? "bg-emerald-500" : p >= 40 ? "bg-amber-500" : "bg-destructive";

  return (
    <div className="space-y-5">
      {/* Step 2 — Paste JD */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
          <h3 className="text-sm font-semibold">Paste Job Description</h3>
        </div>
        <textarea
          value={jd}
          onChange={(e) => { setJd(e.target.value); if (phase !== "idle") { setPhase("idle"); setMatch(null); setOptimized(null); } }}
          rows={8}
          placeholder="Paste the full job description here — title, responsibilities, required skills…"
          className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
        />
        <button
          onClick={analyze}
          disabled={!jd.trim() || phase === "analyzing"}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {phase === "analyzing" ? (
            <><Spinner /> Analyzing…</>
          ) : (
            <><ScanIcon /> Analyze Match</>
          )}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Step 3 — Match Results */}
      {match && phase !== "idle" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
            <h3 className="text-sm font-semibold">Match Analysis</h3>
          </div>

          {/* Match % bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Resume ↔ Job match</span>
              <span className={`text-xl font-bold tabular-nums ${scoreColor(match.matchPercent)}`}>
                {match.matchPercent}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${matchBarColor(match.matchPercent)}`}
                style={{ width: `${match.matchPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Detected role: <span className="font-medium text-foreground">{match.suggestedTarget.replace(/_/g, " ")}</span>
              {" · "}Job title: <span className="font-medium text-foreground">{match.jobTitle}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Missing */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">
                Missing ({match.missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {match.missingKeywords.slice(0, 20).map((k) => (
                  <span key={k} className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-xs text-destructive">
                    {k}
                  </span>
                ))}
                {match.missingKeywords.length > 20 && (
                  <span className="text-xs text-muted-foreground">+{match.missingKeywords.length - 20} more</span>
                )}
              </div>
            </div>

            {/* Matched */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Matched ({match.matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {match.matchedKeywords.slice(0, 20).map((k) => (
                  <span key={k} className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Step 4 — Optimize */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              onClick={optimize}
              disabled={phase === "optimizing" || phase === "optimized"}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {phase === "optimizing" ? (
                <><Spinner /> Optimizing…</>
              ) : phase === "optimized" ? (
                <><CheckIcon /> Optimized</>
              ) : (
                <><SparkleIcon /> Optimize Resume (target 90%+ ATS)</>
              )}
            </button>
            <a
              href={match.linkedInSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-sm"
            >
              <LinkedInIcon />
              Find matching jobs
            </a>
          </div>
        </div>
      )}

      {/* Step 4 result — Optimized Resume */}
      {optimized && phase === "optimized" && (
        <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">4</span>
              <h3 className="text-sm font-semibold">Optimized Resume Ready</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                ATS: <span className="font-bold text-foreground">{optimized.before_score}</span>
                {" → "}
                <span className={`font-bold ${scoreColor(optimized.after_score)}`}>{optimized.after_score}</span>
              </span>
              <button onClick={copyOptimized} className="btn-outline btn-sm text-xs">
                {copied ? "Copied!" : "Copy text"}
              </button>
            </div>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
            {optimized.content_md}
          </pre>
          <p className="text-xs text-muted-foreground">
            Missing keywords from the JD have been injected into your Skills section. Save as PDF and submit.
          </p>
        </div>
      )}
    </div>
  );
}

// Tiny inline icons — no external deps
function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
