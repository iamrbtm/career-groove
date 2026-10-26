import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
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
