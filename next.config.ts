import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
export default nextConfig;
