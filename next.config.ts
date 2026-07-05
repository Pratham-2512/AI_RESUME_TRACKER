import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin tracing root to this project (silences multi-lockfile root inference warning).
  outputFileTracingRoot: path.join(__dirname),
  // Keep native/worker-bearing parsers out of the bundle; load them at runtime.
  serverExternalPackages: ["pdf-parse", "mammoth", "word-extractor", "@napi-rs/canvas", "pdfjs-dist"],
  // pdfjs-dist loads pdf.worker.mjs via a dynamic import the file tracer can't
  // see, so the worker never reaches the lambda. Force-include it for the
  // routes that parse PDFs.
  outputFileTracingIncludes: {
    "/api/resume/upload": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
