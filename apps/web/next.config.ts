import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/core ships TypeScript source (no build step).
  transpilePackages: ["@anv/core"],
};

export default nextConfig;
