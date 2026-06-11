"use client";

import { useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { lineDiff } from "@/lib/domain/diff";
import { SectionCard, ScoreRing, MetricBar, Chips, ErrorBanner, ThinkingState, Badge } from "@/components/shared/ui";

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

  const inputsReady = jdText.trim().length >= 30 && (usePaste ? resumeText.trim().length >= 30 : !!resumeId);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Your résumé"
          right={resumes.length > 0 ? (
            <button onClick={() => setUsePaste(!usePaste)} className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
              {usePaste ? "Pick saved résumé" : "Paste text instead"}
            </button>
          ) : undefined}
        >
          {usePaste ? (
            <textarea className="field" rows={10} placeholder="Paste your résumé text…" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          ) : (
            <select className="field" value={resumeId} onChange={(e) => setResumeId(e.target.value)} aria-label="Résumé">
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
            </select>
          )}
        </SectionCard>
        <SectionCard title="Job description">
          <textarea className="field" rows={10} placeholder="Paste the full job description…" value={jdText} onChange={(e) => setJdText(e.target.value)} aria-label="Job description" />
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run(false)} disabled={busy !== null || !inputsReady} className="btn-primary">
          {busy === "analyze" ? "Analyzing…" : "Analyze match"}
        </button>
        <button onClick={() => run(true)} disabled={busy !== null || !inputsReady} className="btn-outline">
          <Sparkles className="h-4 w-4 text-primary" />
          {busy === "generate" ? "Tailoring…" : "Generate tailored résumé (AI)"}
        </button>
        {data && (
          <button onClick={() => download("tailoring-report.md", reportToMd(data.report), "text/markdown")} className="btn-ghost">
            <Download className="h-4 w-4" /> Export report
          </button>
        )}
        {!inputsReady && !busy && (
          <p className="text-xs text-muted-foreground">Paste a job description (30+ characters) to begin.</p>
        )}
      </div>
      {err && <ErrorBanner>{err}</ErrorBanner>}

      {busy && <ThinkingState label={busy === "analyze" ? "Analyzing your match…" : "Generating tailored résumé…"} sublabel="Scoring keywords, skills, experience, structure, and quantification" />}

      {data && !busy && <Results data={data} onDownload={download} />}
    </div>
  );
}

function Results({ data, onDownload }: { data: Resp; onDownload: (n: string, t: string, m: string) => void }) {
  const { report: rep, tailored, aiUnavailable } = data;
  return (
    <div className="animate-fade-up space-y-6">
      {/* 1 · Match score + ATS — the "will I get shortlisted?" answer comes first */}
      <SectionCard title="ATS compatibility" desc="How résumé screening software will score you">
        <div className="flex flex-wrap items-center gap-8">
          <ScoreRing value={rep.ats.overall} label="ATS match" size={128} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Interview probability</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{rep.interviewProbability.label}</p>
            <p className="text-sm tabular-nums text-muted-foreground">~{rep.interviewProbability.pct}% likelihood</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {([["Keyword", rep.ats.keywordMatch], ["Skills", rep.ats.skillsMatch], ["Experience", rep.ats.experienceMatch], ["Structure", rep.ats.structure], ["Quantification", rep.ats.quantification]] as const).map(([l, v]) => (
            <MetricBar key={l} label={l} value={v} />
          ))}
        </div>
      </SectionCard>

      {/* 2 · Skill gap */}
      <SectionCard title="Skill gap" desc="JD skills you have vs. skills you're missing">
        <div className="space-y-4">
          {rep.gap.map((g) => (
            <MetricBar
              key={g.skill}
              label={<span className="inline-flex items-center gap-2">{g.skill} <Badge tone={g.have ? "ok" : "gap"}>{g.have ? "have" : "missing"}</Badge></span>}
              value={g.level}
              showValue={false}
              tone={g.have ? "bg-success" : "bg-destructive"}
            />
          ))}
          {rep.gap.length === 0 && <p className="text-sm text-muted-foreground">No JD skills detected.</p>}
        </div>
      </SectionCard>

      {/* 3 · Keywords */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Matched keywords"><Chips items={rep.matchedKeywords} tone="ok" empty="None matched." /></SectionCard>
        <SectionCard title="Missing keywords"><Chips items={rep.missingKeywords} tone="gap" empty="Full coverage." /></SectionCard>
      </section>

      {/* 4 · Bullet improvements */}
      <SectionCard title={`Bullet improvements (${rep.bulletImprovements.length})`}>
        {rep.bulletImprovements.length === 0 ? <p className="text-sm text-muted-foreground">No weak bullets detected.</p> : (
          <ul className="space-y-2.5">
            {rep.bulletImprovements.slice(0, 15).map((b, i) => (
              <li key={i} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                <p className="font-medium">&ldquo;{b.original}&rdquo;</p>
                <p className="mt-1.5 text-xs text-destructive">{b.issues.join(" · ")}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">→ {b.suggestion}</p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 5 · Recommendations */}
      <SectionCard title="Recruiter recommendations">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{rep.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </SectionCard>

      {/* 6 · AI tailoring result OR gated message */}
      {aiUnavailable && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm leading-relaxed text-amber-700 dark:text-amber-400">{aiUnavailable}</div>
      )}
      {tailored && (
        <>
          <SectionCard
            title="Change summary"
            right={
              <div className="flex gap-1.5">
                <button onClick={() => onDownload("tailored-resume.md", tailored.content_md, "text/markdown")} className="btn-outline btn-sm">.md</button>
                <button onClick={() => onDownload("tailored-resume.txt", tailored.content_md, "text/plain")} className="btn-outline btn-sm">.txt</button>
                {tailored.versionId && <a href={`/print/resume/${tailored.versionId}`} target="_blank" className="btn-outline btn-sm">PDF</a>}
              </div>
            }
          >
            {tailored.added_keywords.length > 0 && <p className="mb-3 text-sm"><span className="text-muted-foreground">Surfaced keywords: </span>{tailored.added_keywords.join(", ")}</p>}
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{tailored.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </SectionCard>

          {/* Side-by-side + diff */}
          <section className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Original"><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{data.originalText}</pre></SectionCard>
            <SectionCard title="Tailored"><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{tailored.content_md}</pre></SectionCard>
          </section>
          <SectionCard title="Diff">
            <pre className="max-h-96 overflow-auto rounded-xl bg-muted/40 p-4 text-xs leading-relaxed">
              {lineDiff(data.originalText, tailored.content_md).map((op, i) => (
                <div key={i} className={op.type === "added" ? "bg-success/15 text-success" : op.type === "removed" ? "bg-destructive/10 text-destructive" : ""}>
                  <span className="select-none opacity-60">{op.type === "added" ? "+ " : op.type === "removed" ? "- " : "  "}</span>{op.text || " "}
                </div>
              ))}
            </pre>
          </SectionCard>
        </>
      )}
    </div>
  );
}
