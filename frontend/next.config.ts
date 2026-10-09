import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  logging: { incomingRequests: false, fetches: { fullUrl: false }, browserToTerminal: false },
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
};

export default nextConfig;
