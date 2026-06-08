"use client";

import { useState } from "react";

type Bullet = { text: string; strong: boolean; quantified: boolean; issues: string[]; suggestion?: string };
type Analysis = {
  bullets: Bullet[]; weakBullets: Bullet[];
  impactScore: number; quantificationScore: number; atsScore: number; qualityScore: number;
  atsBreakdown: Record<string, number>; missingKeywords: string[];
};

export function ResumeInspector({ resumeId }: { resumeId: string }) {
  const [a, setA] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/resume/inspect", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId, persist: true }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setA(j.data);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Instant analysis</h3>
          <p className="text-xs text-muted-foreground">Deterministic — no AI key needed.</p>
        </div>
        <button onClick={run} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Analyzing…" : a ? "Re-run" : "Run analysis"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {a && (
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Score label="Quality" value={a.qualityScore} accent />
            <Score label="ATS" value={a.atsScore} />
            <Score label="Impact" value={a.impactScore} />
            <Score label="Quantified" value={a.quantificationScore} />
          </div>

          {a.missingKeywords.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold">Missing keywords</p>
              <div className="flex flex-wrap gap-2">
                {a.missingKeywords.map((k) => <span key={k} className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive">{k}</span>)}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold">Weak bullets ({a.weakBullets.length} of {a.bullets.length})</p>
            {a.weakBullets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weak bullets — strong résumé.</p>
            ) : (
              <ul className="space-y-2">
                {a.weakBullets.slice(0, 12).map((b, i) => (
                  <li key={i} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium">“{b.text}”</p>
                    <p className="mt-1 text-xs text-destructive">{b.issues.join(" · ")}</p>
                    {b.suggestion && <p className="mt-1 text-xs text-muted-foreground">→ {b.suggestion}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Score({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
