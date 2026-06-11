"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createResumeFromText, createResumeFromUpload } from "@/actions/resumes";

const TARGETS = [
  ["ats", "ATS-optimized"], ["ai_engineer", "AI Engineer"], ["data_analyst", "Data Analyst"],
  ["software_developer", "Software Developer"], ["ml_engineer", "ML Engineer"], ["generic", "Generic"],
] as const;

const ACCEPT = ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_MB = 10;
const ALLOWED = ["pdf", "doc", "docx", "txt"];

type Upload = {
  fileName: string;
  fileSize: number;
  charCount: number;
  storagePath: string | null;
  stored: boolean;
  storageWarning: string | null;
};

function extOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function ResumeCreate() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("ats");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);

  function reset() {
    setLabel(""); setTarget("ats"); setText(""); setError(null);
    setUpload(null); setBusy(false); setMode("upload");
  }

  async function handleFile(file: File) {
    setError(null);
    // Client-side pre-validation (server re-validates authoritatively)
    const ext = extOf(file.name);
    if (!ALLOWED.includes(ext)) {
      setError(`Unsupported format${ext ? ` ".${ext}"` : ""}. Use PDF, DOC, DOCX, or TXT.`);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`);
      return;
    }
    setBusy(true);
    setUpload(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message ?? "Upload failed");
      const d = json.data as Upload & { text: string };
      setText(d.text);
      if (!label) setLabel(d.fileName.replace(/\.[a-z0-9]+$/i, ""));
      setUpload({
        fileName: d.fileName, fileSize: d.fileSize, charCount: d.charCount,
        storagePath: d.storagePath, stored: d.stored, storageWarning: d.storageWarning,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function save() {
    start(async () => {
      setError(null);
      try {
        const id = upload
          ? await createResumeFromUpload({ label, text, target, storagePath: upload.storagePath, fileName: upload.fileName })
          : await createResumeFromText({ label, text, target });
        router.push(`/app/resumes/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        + Add résumé
      </button>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-sm">
        <button
          onClick={() => setMode("upload")}
          className={`rounded px-3 py-1.5 font-medium transition ${mode === "upload" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >Upload file</button>
        <button
          onClick={() => setMode("paste")}
          className={`rounded px-3 py-1.5 font-medium transition ${mode === "paste" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >Paste text</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TARGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Drag & drop zone */}
      {mode === "upload" && (
        <div className="mt-4">
          <input
            ref={fileInput} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            disabled={busy}
            className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition
              ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}
              ${busy ? "cursor-wait opacity-70" : "cursor-pointer"}`}
          >
            {busy ? (
              <>
                <Spinner />
                <p className="mt-3 text-sm font-medium">Uploading &amp; extracting text…</p>
              </>
            ) : (
              <>
                <svg className="h-9 w-9 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                <p className="mt-3 text-base font-semibold">Drop résumé here</p>
                <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground">PDF • DOC • DOCX • TXT</p>
                <p className="mt-1 text-xs text-muted-foreground">or click to upload &middot; max {MAX_MB} MB</p>
              </>
            )}
          </button>

          {/* Upload status */}
          {upload && (
            <div className="mt-3 rounded-lg border bg-background p-3 text-sm">
              <p className="font-medium">{upload.fileName} <span className="text-xs text-muted-foreground">({(upload.fileSize / 1024).toFixed(0)} KB)</span></p>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                <li className="text-emerald-600 dark:text-emerald-400">✓ Uploaded</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ Parsed</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ {upload.charCount.toLocaleString()} characters extracted</li>
                {!upload.stored && (
                  <li className="text-amber-600 dark:text-amber-400">⚠ Original file not stored ({upload.storageWarning ?? "storage unavailable"}). Text was still extracted.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Editable text (shared — extracted text lands here and stays editable) */}
      <textarea
        className="mt-4 w-full rounded-md border bg-background px-3 py-2 text-sm" rows={mode === "upload" ? 8 : 12}
        placeholder={mode === "upload" ? "Extracted text appears here — edit before saving…" : "Paste your résumé text here…"}
        value={text} onChange={(e) => setText(e.target.value)}
      />

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          disabled={pending || busy || text.trim().length < 50}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >{pending ? "Saving…" : "Save résumé"}</button>
        <button onClick={() => { setOpen(false); reset(); }} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-7 w-7 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
