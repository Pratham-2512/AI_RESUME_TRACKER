"use client";

import { useState } from "react";
import { lineDiff } from "@/lib/domain/diff";

type Report = {
  matchScore: number; interviewProbability: { label: string; pct: number };
  matchedKeywords: string[]; missingKeywords: string[]; prioritySkills: string[];
  ats: { overall: number; keywordMatch: number; skillsMatch: number; experienceMatch: number; structure: number; quantification: number };
  gap: { skill: string; level: number; have: boolean }[];
  bulletImprovements: { original: string; issues: string[]; suggestion: string }[];
  recommendations: string[];
};
type Tailored = { content_md: string; changes: string[]; added_keywords: string[]; versionId: string | null };
type Resp = { report: Report; tailored: Tailored | null; aiUnavailable: string | null; originalText: string };

export function TailorStudio({ resumes }: { resumes: { id: string; label: string | null }[] }) {
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [usePaste, setUsePaste] = useState(resumes.length === 0);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [busy, setBusy] = useState<null | "analyze" | "generate">(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Resp | null>(null);

  async function run(generate: boolean) {
    setBusy(generate ? "generate" : "analyze"); setErr(null);
    try {
      const payload: Record<string, unknown> = { jdText, generate };
      if (usePaste) payload.resumeText = resumeText; else payload.resumeId = resumeId;
      const r = await fetch("/api/resume/tailor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setData(j.data);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  function download(name: string, text: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  function reportToMd(rep: Report): string {
    return [
      `# Tailoring Report`, ``, `ATS Match: ${rep.ats.overall}  ·  Interview probability: ${rep.interviewProbability.label} (~${rep.interviewProbability.pct}%)`, ``,
      `## ATS Breakdown`, `- Keyword: ${rep.ats.keywordMatch}`, `- Skills: ${rep.ats.skillsMatch}`, `- Experience: ${rep.ats.experienceMatch}`, `- Structure: ${rep.ats.structure}`, `- Quantification: ${rep.ats.quantification}`, ``,
      `## Matched keywords`, rep.matchedKeywords.join(", ") || "—", ``,
      `## Missing keywords`, rep.missingKeywords.join(", ") || "—", ``,
      `## Recommendations`, ...rep.recommendations.map((r) => `- ${r}`),
    ].join("\n");
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Your résumé</h3>
            {resumes.length > 0 && (
              <button onClick={() => setUsePaste(!usePaste)} className="text-xs text-primary hover:underline">
                {usePaste ? "Pick saved résumé" : "Paste text instead"}
              </button>
            )}
          </div>
          {usePaste ? (
            <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={10} placeholder="Paste your résumé text…" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          ) : (
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
            </select>
          )}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="mb-2 font-semibold">Job description</h3>
          <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={10} placeholder="Paste the full job description…" value={jdText} onChange={(e) => setJdText(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => run(false)} disabled={busy !== null || jdText.trim().length < 30 || (usePaste ? resumeText.trim().length < 30 : !resumeId)}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy === "analyze" ? "Analyzing…" : "Analyze match"}
        </button>
        <button onClick={() => run(true)} disabled={busy !== null || jdText.trim().length < 30 || (usePaste ? resumeText.trim().length < 30 : !resumeId)}
          className="rounded-md border px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
          {busy === "generate" ? "Tailoring…" : "Generate tailored résumé (AI)"}
        </button>
        {data && <button onClick={() => download("tailoring-report.md", reportToMd(data.report), "text/markdown")} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">Export report (.md)</button>}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {data && <Results data={data} onDownload={download} />}
    </div>
  );
}

function Results({ data, onDownload }: { data: Resp; onDownload: (n: string, t: string, m: string) => void }) {
  const { report: rep, tailored, aiUnavailable } = data;
  return (
    <div className="space-y-6">
      {/* ATS breakdown */}
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-6">
          <Ring value={rep.ats.overall} />
          <div>
            <p className="text-sm text-muted-foreground">Interview probability</p>
            <p className="text-xl font-bold">{rep.interviewProbability.label} · ~{rep.interviewProbability.pct}%</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([["Keyword", rep.ats.keywordMatch], ["Skills", rep.ats.skillsMatch], ["Experience", rep.ats.experienceMatch], ["Structure", rep.ats.structure], ["Quantification", rep.ats.quantification]] as const).map(([l, v]) => (
            <Bar key={l} label={l} value={v} />
          ))}
        </div>
      </section>

      {/* Skill gap */}
      <section className="rounded-lg border bg-card p-5">
        <h3 className="mb-3 font-semibold">Skill gap</h3>
        <div className="space-y-2">
          {rep.gap.map((g) => (
            <div key={g.skill}>
              <div className="flex justify-between text-sm"><span>{g.skill}</span><span className={g.have ? "text-primary" : "text-destructive"}>{g.have ? "have" : "missing"}</span></div>
              <div className="mt-1 h-2 rounded bg-muted"><div className={`h-2 rounded ${g.have ? "bg-primary" : "bg-destructive"}`} style={{ width: `${g.level}%` }} /></div>
            </div>
          ))}
          {rep.gap.length === 0 && <p className="text-sm text-muted-foreground">No JD skills detected.</p>}
        </div>
      </section>

      {/* Keywords */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Matched keywords"><Chips items={rep.matchedKeywords} tone="ok" empty="None matched." /></Card>
        <Card title="Missing keywords"><Chips items={rep.missingKeywords} tone="gap" empty="Full coverage." /></Card>
      </section>

      {/* Bullet improvements */}
      <section className="rounded-lg border bg-card p-5">
        <h3 className="mb-3 font-semibold">Bullet improvements ({rep.bulletImprovements.length})</h3>
        {rep.bulletImprovements.length === 0 ? <p className="text-sm text-muted-foreground">No weak bullets detected.</p> : (
          <ul className="space-y-2">
            {rep.bulletImprovements.slice(0, 15).map((b, i) => (
              <li key={i} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                <p className="font-medium">“{b.original}”</p>
                <p className="mt-1 text-xs text-destructive">{b.issues.join(" · ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">→ {b.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommendations */}
      <section className="rounded-lg border bg-card p-5">
        <h3 className="mb-2 font-semibold">Recommendations</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">{rep.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </section>

      {/* AI tailoring result OR gated message */}
      {aiUnavailable && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-4 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">{aiUnavailable}</div>
      )}
      {tailored && (
        <>
          <section className="rounded-lg border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Change summary</h3>
              <div className="flex gap-2">
                <button onClick={() => onDownload("tailored-resume.md", tailored.content_md, "text/markdown")} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">.md</button>
                <button onClick={() => onDownload("tailored-resume.txt", tailored.content_md, "text/plain")} className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">.txt</button>
                {tailored.versionId && <a href={`/print/resume/${tailored.versionId}`} target="_blank" className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">PDF</a>}
              </div>
            </div>
            {tailored.added_keywords.length > 0 && <p className="mb-2 text-sm"><span className="text-muted-foreground">Surfaced keywords: </span>{tailored.added_keywords.join(", ")}</p>}
            <ul className="list-disc space-y-1 pl-5 text-sm">{tailored.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>

          {/* Side-by-side + diff */}
          <section className="grid gap-4 lg:grid-cols-2">
            <Card title="Original"><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{data.originalText}</pre></Card>
            <Card title="Tailored"><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">{tailored.content_md}</pre></Card>
          </section>
          <section className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 font-semibold">Diff</h3>
            <pre className="max-h-96 overflow-auto rounded bg-muted/40 p-3 text-xs leading-relaxed">
              {lineDiff(data.originalText, tailored.content_md).map((op, i) => (
                <div key={i} className={op.type === "added" ? "bg-green-500/15 text-green-700 dark:text-green-400" : op.type === "removed" ? "bg-red-500/15 text-red-700 dark:text-red-400" : ""}>
                  <span className="select-none opacity-60">{op.type === "added" ? "+ " : op.type === "removed" ? "- " : "  "}</span>{op.text || " "}
                </div>
              ))}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}

function Ring({ value }: { value: number }) {
  return <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary text-2xl font-bold text-primary">{value}</div>;
}
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{value}</span></div>
      <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${value}%` }} /></div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5"><h3 className="mb-2 font-semibold">{title}</h3>{children}</div>;
}
function Chips({ items, tone, empty }: { items: string[]; tone: "ok" | "gap"; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="flex flex-wrap gap-2">{items.map((s) => <span key={s} className={`rounded-full px-2.5 py-1 text-xs ${tone === "ok" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{s}</span>)}</div>;
}
