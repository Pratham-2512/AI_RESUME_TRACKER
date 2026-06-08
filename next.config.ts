import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin tracing root to this project (silences multi-lockfile root inference warning).
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
