import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip linting and type checking during build (reduces memory usage)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable image optimization for serverless
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
