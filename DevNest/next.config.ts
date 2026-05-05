import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the file-tracing root to this app so Next does not pick up a lockfile
  // higher up in the user's home directory.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
