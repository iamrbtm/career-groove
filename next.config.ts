import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@valkey/valkey-glide": false,
    };
    return config;
  },
};

export default nextConfig;
