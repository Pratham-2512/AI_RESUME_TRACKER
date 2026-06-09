"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateWeeklyReport } from "@/actions/copilot";

/** "Save this week's report" — persists the current report to the timeline. */
export function SaveWeeklyReport() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => start(async () => {
          setMsg(null);
          try { const r = await generateWeeklyReport(); setMsg(`Saved (health ${r.overall}) ✓`); router.refresh(); }
          catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
        })}
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {pending ? "Saving…" : "💾 Save this week’s report"}
      </button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
