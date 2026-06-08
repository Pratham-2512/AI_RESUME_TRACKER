"use client";

import { useState } from "react";

type Analysis = {
  matchScore: number;
  interviewProbability: { label: string; pct: number };
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  strategy: string;
  recommendedResume: string;
  requirements: { skills: string[]; yearsRequired: number | null };
  persistedJobId: string | null;
};

export function OpportunityAnalyzer() {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [jobText, setJobText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  async function analyze() {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/opportunities/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "url" ? { jobUrl, persist: true } : { jobText, persist: true }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setResult(j.data);
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex gap-1">
          <Tab active={mode === "text"} onClick={() => setMode("text")}>Paste description</Tab>
          <Tab active={mode === "url"} onClick={() => setMode("url")}>Paste URL</Tab>
        </div>
        {mode === "text" ? (
          <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={14}
            placeholder="Paste the full job description here…" value={jobText} onChange={(e) => setJobText(e.target.value)} />
        ) : (
          <input className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="https://… (LinkedIn / Naukri / company careers page)" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <button onClick={analyze} disabled={busy || (mode === "text" ? jobText.trim().length < 30 : !jobUrl)}
          className="mt-3 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Analyzing…" : "Analyze fit"}
        </button>
      </div>

      <div className="rounded-lg border bg-card p-5">
        {!result ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Paste a job and hit Analyze to get a match score, interview probability, skill gaps, and an application strategy.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <Ring label="Match" value={`${result.matchScore}%`} />
              <div>
                <p className="text-sm text-muted-foreground">Interview probability</p>
                <p className="text-xl font-bold">{result.interviewProbability.label} · ~{result.interviewProbability.pct}%</p>
                <p className="mt-1 text-xs text-muted-foreground">Recommended résumé: <span className="font-medium text-foreground">{result.recommendedResume}</span></p>
              </div>
            </div>

            <Section title="Strengths (you have these)">
              <Chips items={result.strengths} tone="ok" empty="No matching skills detected." />
            </Section>
            <Section title="Missing skills (close these)">
              <Chips items={result.missingSkills} tone="gap" empty="No gaps — strong coverage." />
            </Section>
            <Section title="Application strategy">
              <p className="text-sm">{result.strategy}</p>
            </Section>
            {result.persistedJobId && (
              <p className="text-xs text-muted-foreground">Saved to Opportunities · matched and stored.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
      {children}
    </button>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-sm font-semibold">{title}</p>{children}</div>;
}
function Chips({ items, tone, empty }: { items: string[]; tone: "ok" | "gap"; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={`rounded-full px-2.5 py-1 text-xs ${tone === "ok" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{s}</span>
      ))}
    </div>
  );
}
function Ring({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary text-xl font-bold text-primary">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
