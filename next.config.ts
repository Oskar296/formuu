import type { NextConfig } from "next";

// Static export so the app can be hosted on GitHub Pages (HTML/CSS/JS only).
// `basePath` is supplied at build time by the GitHub Action (e.g. "/formuu")
// so links/assets resolve correctly under github.io/<repo>/. Locally it's empty.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

export default nextConfig;
