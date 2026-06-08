"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createResumeFromText } from "@/actions/resumes";

const TARGETS = [
  ["ats", "ATS-optimized"], ["ai_engineer", "AI Engineer"], ["data_analyst", "Data Analyst"],
  ["software_developer", "Software Developer"], ["ml_engineer", "ML Engineer"], ["generic", "Generic"],
] as const;

export function ResumeCreate() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("ats");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        + Add résumé
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <textarea
        className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" rows={10}
        placeholder="Paste your résumé text here…  (PDF/DOCX upload + auto-parse comes next phase)"
        value={text} onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => start(async () => {
            setError(null);
            try {
              const id = await createResumeFromText({ label, text, target });
              router.push(`/app/resumes/${id}`);
            } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
          })}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >{pending ? "Saving…" : "Save résumé"}</button>
        <button onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}
