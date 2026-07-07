import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone" — Solo descomentar para Docker/VPS self-hosted
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
