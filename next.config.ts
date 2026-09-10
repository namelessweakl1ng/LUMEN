import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone build that can be run without node_modules.
  // Useful for Docker deployments. For local dev, `bun run dev` is
  // unaffected.
  reactStrictMode: true,
};

export default nextConfig;
