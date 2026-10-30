import type { NextConfig } from "next";

// Static export for GitHub Pages (NEXT_BASE_PATH=/SplitSheet).
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: basePath || undefined,
  trailingSlash: true,
};

export default nextConfig;
