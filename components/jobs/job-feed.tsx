"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ExternalLink, Star, X, ClipboardList } from "lucide-react";
import { dismissOpportunity, starOpportunity, trackOpportunity } from "@/actions/jobs";
import { Badge, Chips, Empty, scoreTone } from "@/components/shared/ui";
import { explainMatch } from "@/lib/domain/matchExplain";
import { cn } from "@/lib/utils";
import type { JobType, WorkMode } from "@/lib/supabase/database.types";

export type FeedJob = {
  id: string; title: string; company: string | null; location: string | null;
  work_mode: WorkMode | null; job_type: JobType | null; salary_text: string | null;
  url: string | null; apply_url: string | null; source: string | null;
  match_score: number | null; matched_skills: string[] | null; missing_skills: string[] | null;
  required_skills: string[] | null; years_required: number | null;
  strategy: string | null; posted_at: string | null; created_at: string; starred: boolean;
  tracked: boolean;
};

export type CandidateContext = { years: number | null; targetRoles: string[] };

const REC_TONES = {
  strong: "bg-success/10 text-success",
  good: "bg-primary/10 text-primary",
  stretch: "bg-warning/10 text-amber-700 dark:text-amber-400",
  skip: "bg-destructive/10 text-destructive",
} as const;

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= n ? "fill-warning text-warning" : "text-border")} />
      ))}
    </span>
  );
}

type Filter = "all" | "strong" | "remote" | "starred";

function age(job: FeedJob): string {
  const d = new Date(job.posted_at ?? job.created_at).getTime();
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function JobFeed({ jobs, candidate }: { jobs: FeedJob[]; candidate: CandidateContext }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (hidden.has(j.id)) return false;
      if (filter === "strong" && (j.match_score ?? 0) < 70) return false;
      if (filter === "remote" && j.work_mode !== "remote") return false;
      if (filter === "starred" && !j.starred) return false;
      if (needle && !`${j.title} ${j.company ?? ""} ${j.location ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [jobs, filter, q, hidden]);

  function dismiss(id: string) {
    setHidden((h) => new Set(h).add(id));
    startTransition(() => dismissOpportunity(id));
  }

  const FILTERS: [Filter, string][] = [
    ["all", `All · ${jobs.length}`],
    ["strong", "70%+ match"],
    ["remote", "Remote"],
    ["starred", "Starred"],
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company, location…"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/60 sm:w-64" />
      </div>

      {!filtered.length && (
        <Empty>
          {jobs.length ? "Nothing matches this filter." : "No jobs yet — add a source above and hit “Fetch new jobs”."}
        </Empty>
      )}

      <div className="space-y-2">
        {filtered.map((j) => {
          const score = j.match_score ?? 0;
          const tone = scoreTone(score);
          const expanded = open === j.id;
          return (
            <div key={j.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-3.5 sm:p-4">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold tabular-nums", tone.text)}>
                  {score}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOpen(expanded ? null : j.id)} className="truncate text-left text-sm font-semibold hover:text-primary">
                      {j.title}
                    </button>
                    {j.starred && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}
                    {j.tracked && <Badge tone="ok">tracked</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[j.company, j.location, j.work_mode, j.salary_text, age(j)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => startTransition(() => starOpportunity(j.id, !j.starred))} aria-label="Star"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-warning">
                    <Star className={cn("h-4 w-4", j.starred && "fill-warning text-warning")} />
                  </button>
                  <button onClick={() => dismiss(j.id)} aria-label="Dismiss"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                  <button onClick={() => setOpen(expanded ? null : j.id)} aria-label="Details"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted">
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                  </button>
                </div>
              </div>

              {expanded && (() => {
                const explanation = explainMatch({
                  title: j.title,
                  matchScore: j.match_score,
                  requiredSkills: j.required_skills ?? [],
                  matchedSkills: j.matched_skills ?? [],
                  missingSkills: j.missing_skills ?? [],
                  yearsRequired: j.years_required,
                  candidateYears: candidate.years,
                  targetRoles: candidate.targetRoles,
                });
                return (
                <div className="space-y-4 border-t border-border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", REC_TONES[explanation.recommendation.tone])}>
                      {explanation.recommendation.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{explanation.recommendation.action}</span>
                  </div>
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {explanation.dimensions.map((d) => (
                      <div key={d.key} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium">{d.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{d.detail}</p>
                        </div>
                        <Stars n={d.stars} />
                      </div>
                    ))}
                  </div>
                  {j.strategy && <p className="text-sm leading-relaxed">{j.strategy}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">You match</p>
                      <Chips items={(j.matched_skills ?? []).slice(0, 10)} tone="ok" empty="No overlapping skills detected." />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Gaps to address</p>
                      <Chips items={(j.missing_skills ?? []).slice(0, 10)} tone="gap" empty="No gaps detected." />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(j.url || j.apply_url) && (
                      <a href={j.apply_url ?? j.url ?? "#"} target="_blank" rel="noopener noreferrer"
                        className="btn-primary btn-sm inline-flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" /> Open posting
                      </a>
                    )}
                    <button onClick={() => startTransition(() => { void trackOpportunity(j.id); })} disabled={j.tracked}
                      className="btn-outline btn-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                      <ClipboardList className="h-3.5 w-3.5" /> {j.tracked ? "In pipeline" : "Track in pipeline"}
                    </button>
                    <code className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      npm run apply -- {j.id.slice(0, 8)}
                    </code>
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
