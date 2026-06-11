"use client";

import { useState } from "react";

type Analysis = {
  before_score: number;
  ats_breakdown: Record<string, number>;
  missing_keywords: string[];
  missing_skills: string[];
  weak_sections: { section: string; issue: string; suggestion: string }[];
  suggestions: { priority: string; area: string; suggestion: string }[];
  strengths?: string[];
  weaknesses?: string[];
};
type Version = { id: string; version_no: number; ats_score: number | null; content_md: string | null };

export function ResumeWorkspace({
  resumeId, initialAnalysis, initialVersions,
}: {
  resumeId: string;
  initialAnalysis: Analysis | null;
  initialVersions: Version[];
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initialAnalysis);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [busy, setBusy] = useState<null | "analyze" | "rewrite">(null);
  const [error, setError] = useState<string | null>(null);
  const latestAfter = versions[0]?.ats_score ?? null;
  const improvement = analysis?.before_score != null && latestAfter != null ? latestAfter - analysis.before_score : null;

  async function analyze() {
    setBusy("analyze"); setError(null);
    try {
      const r = await fetch("/api/ai/resume/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setAnalysis(j.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function rewrite() {
    setBusy("rewrite"); setError(null);
    try {
      const r = await fetch("/api/ai/resume/rewrite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId, target: "ats" }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setVersions([{ id: j.data.id, version_no: j.data.version_no, ats_score: j.data.after_score, content_md: j.data.content_md }, ...versions]);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6">
        <ScorePill label="ATS Before" value={analysis?.before_score ?? null} />
        <span className="text-2xl text-muted-foreground">→</span>
        <ScorePill label="ATS After" value={latestAfter} accent />
        {improvement != null && (
          <div className="text-center">
            <div className={`flex h-20 items-center justify-center rounded-lg px-4 text-xl font-bold ${improvement >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {improvement >= 0 ? "+" : ""}{improvement}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Improvement</p>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={analyze} disabled={busy !== null} className="btn-outline">
            {busy === "analyze" ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze ATS"}
          </button>
          <button onClick={rewrite} disabled={busy !== null} className="btn-primary">
            {busy === "rewrite" ? "Rewriting…" : "AI rewrite"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {analysis && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-semibold">ATS breakdown</h3>
            <div className="mt-3 space-y-2">
              {Object.entries(analysis.ats_breakdown).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span className="capitalize">{k}</span><span>{v}</span></div>
                  <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Gaps</h3>
            {(analysis.strengths?.length ?? 0) > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Strengths</p>
                <ul className="mt-0.5 space-y-0.5">
                  {analysis.strengths!.map((s, i) => <li key={i} className="text-sm text-muted-foreground">✓ {s}</li>)}
                </ul>
              </div>
            )}
            {(analysis.weaknesses?.length ?? 0) > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-destructive">Weaknesses</p>
                <ul className="mt-0.5 space-y-0.5">
                  {analysis.weaknesses!.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
                </ul>
              </div>
            )}
            {analysis.missing_skills.length > 0 && (
              <p className="mt-2 text-sm"><span className="text-muted-foreground">Missing skills: </span>{analysis.missing_skills.join(", ")}</p>
            )}
            {analysis.missing_keywords.length > 0 && (
              <p className="mt-1 text-sm"><span className="text-muted-foreground">Missing keywords: </span>{analysis.missing_keywords.join(", ")}</p>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {analysis.suggestions.map((s, i) => (
                <li key={i} className="rounded-md bg-muted p-2">
                  <span className="mr-2 rounded px-1.5 py-0.5 text-xs uppercase text-primary">{s.priority}</span>
                  <span className="font-medium">{s.area}:</span> {s.suggestion}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold">AI versions</h3>
          <div className="mt-3 space-y-3">
            {versions.map((v) => (
              <details key={v.id} className="rounded-md border">
                <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                  v{v.version_no} · ATS {v.ats_score ?? "—"}
                </summary>
                <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-sm">{v.content_md}</pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold ${accent ? "border-primary text-primary" : "border-muted"}`}>
        {value ?? "—"}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
