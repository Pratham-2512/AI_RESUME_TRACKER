"use client";

import { useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { addJobSource, deleteJobSource, toggleJobSource, runIngestNow } from "@/actions/jobs";
import { Badge, SectionCard } from "@/components/shared/ui";
import type { JobSourceKind } from "@/lib/supabase/database.types";

export type SourceItem = {
  id: string; kind: JobSourceKind; board: string; label: string | null; active: boolean;
  last_run_at: string | null; last_status: string | null; last_count: number | null;
};

const KIND_HELP: Record<JobSourceKind, { name: string; placeholder: string }> = {
  greenhouse: { name: "Greenhouse", placeholder: "board token, e.g. anthropic" },
  lever: { name: "Lever", placeholder: "company slug, e.g. netflix" },
  remotive: { name: "Remotive", placeholder: "search query, e.g. ai engineer" },
};

export function SourceManager({ sources }: { sources: SourceItem[] }) {
  const [kind, setKind] = useState<JobSourceKind>("remotive");
  const [board, setBoard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [running, startRun] = useTransition();

  function add() {
    if (!board.trim()) return;
    setError(null);
    startAdd(async () => {
      try { await addJobSource({ kind, board }); setBoard(""); }
      catch (e) { setError(e instanceof Error ? e.message : "Could not add source"); }
    });
  }

  function runNow() {
    setError(null); setSummary(null);
    startRun(async () => {
      try {
        const s = await runIngestNow();
        setSummary(s.ran === 0 ? "No active sources to poll." : `Polled ${s.ran} source${s.ran === 1 ? "" : "s"} — ${s.totalAdded} new job${s.totalAdded === 1 ? "" : "s"}.`);
      } catch (e) { setError(e instanceof Error ? e.message : "Ingest failed"); }
    });
  }

  return (
    <SectionCard
      title="Job sources"
      desc="Public boards polled nightly (and on demand). Greenhouse/Lever boards + Remotive searches."
      right={
        <button onClick={runNow} disabled={running || !sources.some((s) => s.active)} className="btn-outline btn-sm inline-flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Fetching…" : "Fetch new jobs"}
        </button>
      }
    >
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            <Badge tone={s.kind === "remotive" ? "primary" : "neutral"}>{KIND_HELP[s.kind].name}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.label ?? s.board}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {s.board}
                {s.last_run_at && ` · last run ${new Date(s.last_run_at).toLocaleString()} · ${s.last_status ?? ""}${s.last_count != null ? ` (+${s.last_count})` : ""}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={s.active} onChange={(e) => toggleJobSource(s.id, e.target.checked)} className="h-3.5 w-3.5 accent-[hsl(var(--primary))]" />
              active
            </label>
            <button onClick={() => deleteJobSource(s.id)} aria-label="Remove source"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!sources.length && (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No sources yet. Add a Remotive search for your target role, or the Greenhouse/Lever boards of companies you follow.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select value={kind} onChange={(e) => setKind(e.target.value as JobSourceKind)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm">
          {(Object.keys(KIND_HELP) as JobSourceKind[]).map((k) => <option key={k} value={k}>{KIND_HELP[k].name}</option>)}
        </select>
        <input value={board} onChange={(e) => setBoard(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={KIND_HELP[kind].placeholder}
          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/60" />
        <button onClick={add} disabled={adding || !board.trim()} className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Add source
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {summary && <p className="mt-2 text-xs text-success">{summary}</p>}
    </SectionCard>
  );
}
