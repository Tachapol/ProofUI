import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let Playwright use an isolated dev output directory when another local
  // ProofUI dev server is already running from the same checkout.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
