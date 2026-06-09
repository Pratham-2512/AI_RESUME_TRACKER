import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin tracing root to this project (silences multi-lockfile root inference warning).
  outputFileTracingRoot: path.join(__dirname),
  // Keep native/worker-bearing parsers out of the bundle; load them at runtime.
  serverExternalPackages: ["pdf-parse", "mammoth"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
