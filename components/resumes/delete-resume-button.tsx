"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteResume, getResumeApplicationCount } from "@/actions/resumes";

interface Props {
  id: string;
  label: string;
}

type State = "idle" | "checking" | "confirming" | "deleting" | "done";

export function DeleteResumeButton({ id, label }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<State>("idle");
  const [appCount, setAppCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("checking");
    startTransition(async () => {
      const count = await getResumeApplicationCount(id);
      setAppCount(count);
      setState("confirming");
    });
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;
    setState("idle");
    setError(null);
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("deleting");
    startTransition(async () => {
      try {
        await deleteResume(id);
        setState("done");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Deletion failed.");
        setState("confirming");
      }
    });
  }

  const modalOpen = state === "checking" || state === "confirming" || state === "deleting" || state === "done";

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={state !== "idle"}
        title={`Delete "${label}"`}
        aria-label={`Delete "${label}"`}
        className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}
          onClick={handleCancel}
        >
          <div
            className="card animate-scale-in mx-auto w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "checking" ? (
              <div className="space-y-3" aria-label="Checking…">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ) : state === "done" ? (
              <p className="text-sm text-success font-medium">Resume deleted.</p>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 rounded-full bg-destructive/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </span>
                  <div>
                    <h2 id="delete-modal-title" className="font-semibold">
                      Delete &ldquo;{label}&rdquo;?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                {appCount > 0 ? (
                  <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      This resume is used in{" "}
                      <strong>{appCount} application{appCount !== 1 ? "s" : ""}</strong>.
                      Deleting it may affect application history.
                    </span>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Are you sure you want to delete this resume? The extracted text, ATS
                    analysis, and stored file will be permanently removed.
                  </p>
                )}

                {error && (
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={handleCancel}
                    disabled={state === "deleting"}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={state === "deleting"}
                    className="btn-destructive"
                  >
                    {state === "deleting" ? "Deleting…" : "Delete resume"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
