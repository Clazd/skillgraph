import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@skillgraph/graph-core", "@skillgraph/renderer"],
};

export default nextConfig;
