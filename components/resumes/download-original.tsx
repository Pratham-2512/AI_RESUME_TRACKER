"use client";

import { useState } from "react";
import { getResumeDownloadUrl } from "@/actions/resumes";

/** Fetches a short-lived signed URL for the original uploaded file and opens it. */
export function DownloadOriginal({ resumeId }: { resumeId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true); setErr(null);
    try {
      const url = await getResumeDownloadUrl(resumeId);
      if (!url) { setErr("No original file on record."); return; }
      window.open(url, "_blank");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        onClick={download}
        disabled={busy}
        className="btn-outline btn-sm"
      >
        {busy ? "Preparing…" : "↓ Download original"}
      </button>
      {err && <span className="mt-1 text-xs text-destructive">{err}</span>}
    </div>
  );
}
