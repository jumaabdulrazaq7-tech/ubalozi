import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGithubActions ? "/ubalozi" : undefined,
  assetPrefix: isGithubActions ? "/ubalozi/" : undefined,
};

export default nextConfig;
