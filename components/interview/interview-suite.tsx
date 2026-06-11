"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, MetricBar, ScoreRing, scoreTone, SectionCard } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

type Question = {
  kind: "technical" | "behavioral" | "hr" | "project";
  difficulty: "easy" | "medium" | "hard";
  question: string;
  suggested_answer: string;
  expected_concepts: string[];
  confidence: number;
  estimatedMinutes: number;
};
type KitResp = { kitId: string | null; title: string; questions: Question[]; jdSkills: string[]; candidateSkills: string[] };

type StarCheck = { situation: boolean; task: boolean; action: boolean; result: boolean; missing: string[]; score: number; improvement: string };
type Evaluation = {
  scores: { communication: number; technical: number; confidence: number; structure: number; completeness: number; overall: number };
  feedback: string[];
  wordCount: number;
  star?: StarCheck;
};

const KIND_LABEL: Record<Question["kind"], string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR", project: "Project" };
const KIND_TONE: Record<Question["kind"], "primary" | "ok" | "warn" | "neutral"> = { technical: "primary", behavioral: "warn", hr: "neutral", project: "ok" };

export function InterviewSuite({
  resumes,
  opportunities,
}: {
  resumes: { id: string; label: string | null }[];
  opportunities: { id: string; title: string; company: string | null }[];
}) {
  const router = useRouter();
  const [oppId, setOppId] = useState(opportunities[0]?.id ?? "");
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [usePaste, setUsePaste] = useState(opportunities.length === 0);
  const [jdText, setJdText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kit, setKit] = useState<KitResp | null>(null);
  const [filter, setFilter] = useState<"all" | Question["kind"]>("all");

  async function generate() {
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, unknown> = { persist: true };
      if (usePaste) payload.jdText = jdText; else if (oppId) payload.opportunityId = oppId;
      if (resumeId) payload.resumeId = resumeId;
      const r = await fetch("/api/interview/kit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setKit(j.data);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to generate kit"); }
    finally { setBusy(false); }
  }

  const grouped = kit ? groupByKind(kit.questions) : null;
  const visible = kit ? (filter === "all" ? kit.questions : kit.questions.filter((q) => q.kind === filter)) : [];

  return (
    <div className="space-y-6">
      {/* Generator */}
      <SectionCard title="Generate an interview kit" desc="Deterministic — works with no AI key. Pulls skills from the job + your résumé.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium">Target job</label>
              {opportunities.length > 0 && (
                <button onClick={() => setUsePaste(!usePaste)} className="text-xs text-primary hover:underline">
                  {usePaste ? "Pick saved opportunity" : "Paste job description"}
                </button>
              )}
            </div>
            {usePaste ? (
              <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={5}
                placeholder="Paste the job description…"
                className="field" />
            ) : (
              <select value={oppId} onChange={(e) => setOppId(e.target.value)} className="field">
                {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}{o.company ? ` · ${o.company}` : ""}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Your résumé <span className="text-muted-foreground">(optional)</span></label>
            {resumes.length > 0 ? (
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className="field">
                <option value="">Use profile skills</option>
                {resumes.map((r) => <option key={r.id} value={r.id}>{r.label ?? "Résumé"}</option>)}
              </select>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">No résumés — questions use your profile skills.</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={generate} disabled={busy || (usePaste ? jdText.trim().length < 20 : !oppId && opportunities.length > 0 && !usePaste)}
            className="btn-primary">
            {busy ? "Generating…" : "Generate kit"}
          </button>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      </SectionCard>

      {/* Kit */}
      {kit && (
        <SectionCard
          title={kit.title}
          desc={`${kit.questions.length} questions · ~${kit.questions.reduce((a, q) => a + q.estimatedMinutes, 0)} min`}
          right={kit.kitId ? <Badge tone="ok">Saved</Badge> : <Badge tone="warn">Not saved</Badge>}
        >
          {/* Category summary + filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            <FilterChip label={`All (${kit.questions.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
            {(["technical", "behavioral", "project", "hr"] as const).map((k) =>
              grouped && grouped[k].length ? (
                <FilterChip key={k} label={`${KIND_LABEL[k]} (${grouped[k].length})`} active={filter === k} onClick={() => setFilter(k)} />
              ) : null
            )}
          </div>
          <div className="space-y-3">
            {visible.map((q, i) => <QuestionCard key={`${q.kind}-${i}`} q={q} kitId={kit.kitId} onEvaluated={() => router.refresh()} />)}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
      {label}
    </button>
  );
}

function QuestionCard({ q, kitId, onEvaluated }: { q: Question; kitId: string | null; onEvaluated: () => void }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [evalResult, setEvalResult] = useState<Evaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/interview/evaluate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, kind: q.kind, question: q.question, expectedConcepts: q.expected_concepts, kitId, persist: true }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setEvalResult(j.data);
      onEvaluated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Evaluation failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONE[q.kind]}>{KIND_LABEL[q.kind]}</Badge>
        <Badge tone="neutral">{q.difficulty}</Badge>
        <Badge tone="neutral">~{q.estimatedMinutes} min</Badge>
        <span className="ml-auto text-xs text-muted-foreground">profile fit {q.confidence}%</span>
      </div>
      <p className="mt-2 text-sm font-medium">{q.question}</p>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <button onClick={() => setShowHint(!showHint)} className="text-primary hover:underline">{showHint ? "Hide" : "Show"} answer guidance</button>
        <button onClick={() => setOpen(!open)} className="text-primary hover:underline">{open ? "Close practice" : "Practice this answer"}</button>
      </div>
      {showHint && <p className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">{q.suggested_answer}</p>}

      {open && (
        <div className="mt-3 space-y-3">
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5}
            placeholder="Type your answer as you'd say it out loud…"
            className="field" />
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={busy || answer.trim().length < 5}
              className="btn-primary btn-sm">
              {busy ? "Evaluating…" : "Evaluate answer"}
            </button>
            <span className="text-xs text-muted-foreground">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
            {err && <span className="text-xs text-destructive">{err}</span>}
          </div>
          {evalResult && <EvaluationView e={evalResult} kind={q.kind} />}
        </div>
      )}
    </div>
  );
}

function EvaluationView({ e, kind }: { e: Evaluation; kind: Question["kind"] }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ScoreRing value={e.scores.overall} label="Overall" size={92} />
        <div className="grid flex-1 gap-2.5">
          <MetricBar label="Communication" value={e.scores.communication} />
          <MetricBar label="Technical" value={e.scores.technical} />
          <MetricBar label="Confidence" value={e.scores.confidence} />
          <MetricBar label="Completeness" value={e.scores.completeness} />
        </div>
      </div>

      {e.star && (kind === "behavioral" || kind === "project") && <StarView star={e.star} />}

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Feedback</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{e.feedback.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </div>
    </div>
  );
}

function StarView({ star }: { star: StarCheck }) {
  const rows: [string, boolean][] = [["Situation", star.situation], ["Task", star.task], ["Action", star.action], ["Result", star.result]];
  return (
    <div className="mt-3 card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">STAR structure</p>
        <span className={cn("text-sm font-bold", scoreTone(star.score).text)}>{star.score}/100</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map(([label, ok]) => (
          <span key={label} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive")}>
            {label} {ok ? "✓" : "✗"}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{star.improvement}</p>
    </div>
  );
}

function groupByKind(qs: Question[]): Record<Question["kind"], Question[]> {
  const g: Record<Question["kind"], Question[]> = { technical: [], behavioral: [], hr: [], project: [] };
  for (const q of qs) g[q.kind].push(q);
  return g;
}
