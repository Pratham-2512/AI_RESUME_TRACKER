"use client";

// Ultimate fallback error boundary. Catches errors thrown in the ROOT layout
// itself (which app/error.tsx cannot catch). It replaces the entire document,
// so it must render its own <html>/<body> and cannot rely on globals.css —
// styles are inlined. This guarantees a user never sees a blank white screen.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#a1a1aa" }}>
            The application failed to start. This is usually a missing or
            misconfigured environment variable in the deployment.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontFamily: "monospace",
                fontSize: 12,
                color: "#a1a1aa",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              background: "#fafafa",
              color: "#0a0a0a",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
