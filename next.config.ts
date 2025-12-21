import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static page generation to reduce build memory
  experimental: {
    // Skip type checking in build (done separately)
    typedRoutes: false,
  },
  // Disable image optimization for serverless
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
