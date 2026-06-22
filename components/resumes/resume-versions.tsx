"use client";

import { useState } from "react";

type Version = { id: string; version_no: number; ats_score: number | null; content_md: string | null };

export function ResumeVersions({ versions: initial }: { versions: Version[] }) {
  const [versions] = useState<Version[]>(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!versions.length) return null;

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const scoreColor = (s: number | null) =>
    s == null ? "text-muted-foreground" :
    s >= 80 ? "text-emerald-600 dark:text-emerald-400" :
    s >= 60 ? "text-amber-600 dark:text-amber-400" : "text-destructive";

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.id} className="rounded-xl border border-border bg-background">
          <button
            onClick={() => setExpanded(expanded === v.id ? null : v.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors rounded-xl"
          >
            <span className="font-medium">Version {v.version_no}</span>
            <div className="flex items-center gap-3">
              {v.ats_score != null && (
                <span className={`text-sm font-bold tabular-nums ${scoreColor(v.ats_score)}`}>
                  ATS {v.ats_score}
                </span>
              )}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${expanded === v.id ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>
          {expanded === v.id && v.content_md && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
              <div className="flex justify-end">
                <button
                  onClick={() => copy(v.id, v.content_md!)}
                  className="btn-outline btn-sm text-xs"
                >
                  {copied === v.id ? "Copied!" : "Copy text"}
                </button>
              </div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                {v.content_md}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
