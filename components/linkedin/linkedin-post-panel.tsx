"use client";

import { useState, useEffect, useCallback } from "react";

type Step = "check" | "connect" | "generate" | "preview" | "posting" | "done" | "error";

interface Generated {
  linkedin_post: string;
  cover_letter: string;
}

export function LinkedInPostPanel({ resumeId }: { resumeId: string }) {
  const [step, setStep] = useState<Step>("check");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [editedPost, setEditedPost] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [tab, setTab] = useState<"post" | "cover">("post");
  const [generating, setGenerating] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/linkedin/status");
      const { connected, expired } = await res.json();
      if (expired) {
        setStep("connect");
      } else if (connected) {
        setStep("generate");
      } else {
        setStep("connect");
      }
    } catch {
      setStep("connect");
    }
  }, []);

  useEffect(() => {
    // Check if redirected back after OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("li_connected") === "1") {
      window.history.replaceState({}, "", window.location.pathname);
      setStep("generate");
      return;
    }
    if (params.get("li_error")) {
      setErrorMsg(`LinkedIn connection error: ${params.get("li_error")}`);
      setStep("error");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    checkStatus();
  }, [checkStatus]);

  async function handleGenerate() {
    setGenerating(true);
    setStep("generate");
    try {
      const res = await fetch("/api/linkedin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Generation failed");
        setStep("error");
        return;
      }
      setGenerated(json.data);
      setEditedPost(json.data.linkedin_post);
      setStep("preview");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStep("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePost() {
    setStep("posting");
    try {
      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postText: editedPost }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error ?? "Posting failed");
        setStep("error");
        return;
      }
      setPostUrl(json.data.postUrl);
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStep("error");
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        {/* LinkedIn logo SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <h2 className="text-base font-semibold">Post to LinkedIn</h2>
      </div>

      {/* CONNECT */}
      {step === "connect" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your LinkedIn account so we can scan your resume, generate a professional post, and publish it for you.
          </p>
          <a
            href="/api/linkedin/auth"
            className="btn-primary btn-sm inline-flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Connect LinkedIn
          </a>
        </div>
      )}

      {/* GENERATE */}
      {step === "generate" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            LinkedIn connected
          </div>
          <p className="text-sm text-muted-foreground">
            Click below to have AI scan your resume and generate a LinkedIn job-search post + cover letter template.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary btn-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                Scanning resume &amp; generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Generate with AI
              </>
            )}
          </button>
          <button
            onClick={() => setStep("connect")}
            className="btn-ghost btn-sm ml-2 text-muted-foreground"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* PREVIEW */}
      {step === "preview" && generated && (
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-1 rounded-lg border border-border p-1 w-fit text-sm">
            <button
              onClick={() => setTab("post")}
              className={`rounded-md px-3 py-1 transition-colors ${tab === "post" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              LinkedIn Post
            </button>
            <button
              onClick={() => setTab("cover")}
              className={`rounded-md px-3 py-1 transition-colors ${tab === "cover" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Cover Letter
            </button>
          </div>

          {tab === "post" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Review &amp; edit before posting
                </label>
                <span className={`text-xs tabular-nums ${editedPost.length > 1200 ? "text-destructive" : "text-muted-foreground"}`}>
                  {editedPost.length} / 1,200
                </span>
              </div>
              <textarea
                value={editedPost}
                onChange={(e) => setEditedPost(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handlePost}
                  disabled={!editedPost.trim() || editedPost.length > 1200}
                  className="btn-primary btn-sm disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Publish to LinkedIn
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-outline btn-sm disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {tab === "cover" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Cover letter template — copy &amp; customise per application
              </label>
              <div className="relative">
                <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed overflow-x-auto">
                  {generated.cover_letter}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(generated.cover_letter)}
                  className="btn-ghost btn-sm absolute top-2 right-2 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POSTING */}
      {step === "posting" && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Publishing to LinkedIn…
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-success font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            Posted to LinkedIn successfully!
          </div>
          <div className="flex gap-2 flex-wrap">
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary btn-sm inline-flex items-center gap-2"
            >
              View post on LinkedIn →
            </a>
            <button
              onClick={() => { setStep("generate"); setGenerated(null); setEditedPost(""); }}
              className="btn-outline btn-sm"
            >
              Post again
            </button>
          </div>
        </div>
      )}

      {/* ERROR */}
      {step === "error" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg || "Something went wrong."}
          </div>
          <button
            onClick={() => { setErrorMsg(""); setStep("check"); checkStatus(); }}
            className="btn-outline btn-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* CHECKING */}
      {step === "check" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          Checking LinkedIn connection…
        </div>
      )}
    </div>
  );
}
