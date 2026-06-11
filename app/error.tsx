"use client";

// Route-segment error boundary. Catches any uncaught error thrown while
// rendering pages under app/ (server or client) and shows a friendly state
// instead of a blank "Application error" screen. See app/global-error.tsx for
// the root-layout fallback.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in Vercel function logs for diagnosis.
    console.error("Page render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md card p-8">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page hit an unexpected error. This usually means a required
          service or environment variable isn&apos;t configured. Try again, and
          if it persists check the deployment configuration.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
